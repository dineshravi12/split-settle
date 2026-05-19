package com.splitsettle.api.service;

import com.splitsettle.api.dto.SettlementDTO;
import com.splitsettle.api.entity.Expense;
import com.splitsettle.api.entity.ExpenseSplit;
import com.splitsettle.api.entity.Group;
import com.splitsettle.api.entity.GroupMember;
import com.splitsettle.api.entity.User;
import com.splitsettle.api.exception.ResourceNotFoundException;
import com.splitsettle.api.repository.ExpenseRepository;
import com.splitsettle.api.repository.ExpenseSplitRepository;
import com.splitsettle.api.repository.GroupMemberRepository;
import com.splitsettle.api.repository.GroupRepository;
import com.splitsettle.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SettlementService {
    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    public List<SettlementDTO> calculateSettlements(Long groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        List<GroupMember> members = groupMemberRepository.findByGroup_Id(groupId);
        Map<Long, BigDecimal> balances = new HashMap<>();
        members.forEach(m -> balances.put(m.getUser().getId(), BigDecimal.ZERO));

        // Find all unsettled splits in this group
        List<ExpenseSplit> allSplits = expenseSplitRepository.findAll().stream()
                .filter(s -> s.getExpense().getGroup().getId().equals(groupId) && !s.getIsSettled())
                .collect(Collectors.toList());

        for (ExpenseSplit split : allSplits) {
            User debtor = split.getUser();
            User creditor = split.getExpense().getPaidBy();

            BigDecimal amount = split.getAmountOwed();

            // Debtor balance decreases, Creditor balance increases
            balances.put(debtor.getId(), balances.get(debtor.getId()).subtract(amount));
            balances.put(creditor.getId(), balances.get(creditor.getId()).add(amount));
        }

        // Greedy Algorithm
        List<UserBalance> userBalances = new ArrayList<>();
        balances.forEach((id, balance) -> {
            User user = userRepository.findById(id).orElseThrow();
            userBalances.add(new UserBalance(user, balance));
        });

        List<SettlementDTO> settlements = new ArrayList<>();

        while (true) {
            // Sort balances to find largest debtor and largest creditor
            userBalances.sort(Comparator.comparing(UserBalance::getBalance));

            UserBalance debtor = userBalances.get(0);
            UserBalance creditor = userBalances.get(userBalances.size() - 1);

            if (debtor.getBalance().compareTo(BigDecimal.ZERO) >= 0 ||
                creditor.getBalance().compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }

            BigDecimal amountToSettle = debtor.getBalance().abs().min(creditor.getBalance());

            settlements.add(SettlementDTO.builder()
                    .from(debtor.getUser().getName())
                    .fromId(debtor.getUser().getId())
                    .to(creditor.getUser().getName())
                    .toId(creditor.getUser().getId())
                    .amount(amountToSettle)
                    .build());

            debtor.setBalance(debtor.getBalance().add(amountToSettle));
            creditor.setBalance(creditor.getBalance().subtract(amountToSettle));
        }

        return settlements;
    }

    @Transactional
    public void settleUp(Long groupId, Long fromUserId, Long toUserId) {
        List<ExpenseSplit> allSplits = expenseSplitRepository.findAll().stream()
                .filter(s -> s.getExpense().getGroup().getId().equals(groupId) &&
                             s.getUser().getId().equals(fromUserId) &&
                             s.getExpense().getPaidBy().getId().equals(toUserId) &&
                             !s.getIsSettled())
                .collect(Collectors.toList());

        if (allSplits.isEmpty()) {
            throw new ResourceNotFoundException("No unsettled debts found from user " + fromUserId + " to user " + toUserId);
        }

        allSplits.forEach(s -> {
            s.setIsSettled(true);
            s.setSettledAt(LocalDateTime.now());
        });

        expenseSplitRepository.saveAll(allSplits);
    }

    private static class UserBalance {
        private final User user;
        private BigDecimal balance;

        public UserBalance(User user, BigDecimal balance) {
            this.user = user;
            this.balance = balance;
        }

        public User getUser() { return user; }
        public BigDecimal getBalance() { return balance; }
        public void setBalance(BigDecimal balance) { this.balance = balance; }
    }
}
