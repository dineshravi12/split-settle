package com.splitsettle.api.service;

import com.splitsettle.api.dto.SettlementDTO;
import com.splitsettle.api.entity.ActivityType;
import com.splitsettle.api.entity.ExpenseSplit;
import com.splitsettle.api.entity.Group;
import com.splitsettle.api.entity.GroupMember;
import com.splitsettle.api.entity.Payment;
import com.splitsettle.api.entity.User;
import com.splitsettle.api.exception.ResourceNotFoundException;
import com.splitsettle.api.repository.ExpenseSplitRepository;
import com.splitsettle.api.repository.GroupMemberRepository;
import com.splitsettle.api.repository.GroupRepository;
import com.splitsettle.api.repository.PaymentRepository;
import com.splitsettle.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SettlementService {
    private final ExpenseSplitRepository expenseSplitRepository;
    private final PaymentRepository paymentRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final GroupAccessService groupAccess;
    private final ActivityService activityService;

    @Transactional(readOnly = true)
    public List<SettlementDTO> calculateSettlements(Long groupId, Long requesterId) {
        groupAccess.requireMember(groupId, requesterId);
        List<SettlementDTO> settlements = computeSettlements(groupId);
        // Only the person paying needs the receiver's UPI ID
        settlements.stream()
                .filter(s -> !s.getFromId().equals(requesterId))
                .forEach(s -> s.setToUpiId(null));
        return settlements;
    }

    @Transactional
    public void settleUp(Long groupId, Long fromUserId, Long toUserId, Long requesterId) {
        groupAccess.requireMember(groupId, requesterId);
        if (!requesterId.equals(fromUserId) && !requesterId.equals(toUserId)) {
            throw new IllegalArgumentException("Only the payer or the receiver can settle this balance");
        }

        SettlementDTO due = computeSettlements(groupId).stream()
                .filter(s -> s.getFromId().equals(fromUserId) && s.getToId().equals(toUserId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Nothing to settle between these members"));

        recordPayment(groupId, due);
    }

    /** Records every suggested transfer the requester is part of; other members' balances are untouched. */
    @Transactional
    public int settleAllForUser(Long groupId, Long requesterId) {
        groupAccess.requireMember(groupId, requesterId);
        List<SettlementDTO> mine = computeSettlements(groupId).stream()
                .filter(s -> s.getFromId().equals(requesterId) || s.getToId().equals(requesterId))
                .toList();
        if (mine.isEmpty()) {
            throw new ResourceNotFoundException("You have no balances to settle in this group");
        }
        mine.forEach(due -> recordPayment(groupId, due));
        return mine.size();
    }

    private void recordPayment(Long groupId, SettlementDTO due) {
        Group group = groupRepository.getReferenceById(groupId);
        User from = userRepository.getReferenceById(due.getFromId());
        User to = userRepository.getReferenceById(due.getToId());
        paymentRepository.save(Payment.builder()
                .group(group)
                .fromUser(from)
                .toUser(to)
                .amount(due.getAmount())
                .build());
        activityService.record(group, from, ActivityType.PAYMENT_RECORDED, to, null, due.getAmount());
    }

    private List<SettlementDTO> computeSettlements(Long groupId) {
        Map<Long, User> users = new HashMap<>();
        Map<Long, BigDecimal> balances = new HashMap<>();

        for (GroupMember member : groupMemberRepository.findByGroup_Id(groupId)) {
            users.put(member.getUser().getId(), member.getUser());
            balances.put(member.getUser().getId(), BigDecimal.ZERO);
        }

        for (ExpenseSplit split : expenseSplitRepository.findByExpense_Group_Id(groupId)) {
            // Flag only set by the old settle flow, before payments were recorded
            if (Boolean.TRUE.equals(split.getIsSettled())) {
                continue;
            }
            balances.merge(split.getUser().getId(), split.getAmountOwed().negate(), BigDecimal::add);
            balances.merge(split.getExpense().getPaidBy().getId(), split.getAmountOwed(), BigDecimal::add);
        }

        for (Payment payment : paymentRepository.findByGroup_Id(groupId)) {
            balances.merge(payment.getFromUser().getId(), payment.getAmount(), BigDecimal::add);
            balances.merge(payment.getToUser().getId(), payment.getAmount().negate(), BigDecimal::add);
        }

        return simplify(balances).stream()
                .map(t -> SettlementDTO.builder()
                        .fromId(t.fromId())
                        .from(users.get(t.fromId()).getName())
                        .toId(t.toId())
                        .to(users.get(t.toId()).getName())
                        .toUpiId(users.get(t.toId()).getUpiId())
                        .amount(t.amount())
                        .build())
                .toList();
    }

    /** Greedy: repeatedly pays the largest debtor's debt to the largest creditor. */
    static List<Transfer> simplify(Map<Long, BigDecimal> balances) {
        List<Account> accounts = new ArrayList<>();
        balances.forEach((userId, balance) -> accounts.add(new Account(userId, balance)));
        Comparator<Account> byBalance = Comparator.comparing((Account a) -> a.balance).thenComparing(a -> a.userId);

        List<Transfer> transfers = new ArrayList<>();
        while (accounts.size() > 1) {
            accounts.sort(byBalance);
            Account debtor = accounts.get(0);
            Account creditor = accounts.get(accounts.size() - 1);
            if (debtor.balance.signum() >= 0 || creditor.balance.signum() <= 0) {
                break;
            }

            BigDecimal amount = debtor.balance.negate().min(creditor.balance);
            transfers.add(new Transfer(debtor.userId, creditor.userId, amount));
            debtor.balance = debtor.balance.add(amount);
            creditor.balance = creditor.balance.subtract(amount);
        }
        return transfers;
    }

    record Transfer(Long fromId, Long toId, BigDecimal amount) {}

    private static final class Account {
        private final Long userId;
        private BigDecimal balance;

        private Account(Long userId, BigDecimal balance) {
            this.userId = userId;
            this.balance = balance;
        }
    }
}
