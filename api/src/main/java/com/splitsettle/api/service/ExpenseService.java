package com.splitsettle.api.service;

import com.splitsettle.api.dto.ExpenseDTO;
import com.splitsettle.api.dto.ExpenseRequest;
import com.splitsettle.api.dto.ExpenseSplitDTO;
import com.splitsettle.api.entity.ActivityType;
import com.splitsettle.api.entity.Expense;
import com.splitsettle.api.entity.ExpenseSplit;
import com.splitsettle.api.entity.Group;
import com.splitsettle.api.entity.SplitType;
import com.splitsettle.api.entity.User;
import com.splitsettle.api.exception.ResourceNotFoundException;
import com.splitsettle.api.repository.ExpenseRepository;
import com.splitsettle.api.repository.GroupMemberRepository;
import com.splitsettle.api.repository.GroupRepository;
import com.splitsettle.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {
    private final ExpenseRepository expenseRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final GroupAccessService groupAccess;
    private final ActivityService activityService;

    @Transactional
    public ExpenseDTO addExpense(ExpenseRequest request, Long requesterId) {
        Long groupId = request.getGroupId();
        groupAccess.requireMember(groupId, requesterId);
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
        Map<Long, User> members = membersById(groupId);

        Expense expense = Expense.builder()
                .group(group)
                .splits(new ArrayList<>())
                .build();
        applyRequest(expense, request, members);
        expense = expenseRepository.save(expense);

        activityService.record(group, members.get(requesterId), ActivityType.EXPENSE_ADDED, null,
                expense.getDescription(), expense.getAmount());
        return mapToDTO(expense);
    }

    @Transactional
    public ExpenseDTO updateExpense(Long expenseId, ExpenseRequest request, Long requesterId) {
        Expense expense = findAccessibleExpense(expenseId, requesterId);
        Map<Long, User> members = membersById(expense.getGroup().getId());

        expense.getSplits().clear();
        applyRequest(expense, request, members);
        expense = expenseRepository.saveAndFlush(expense);

        activityService.record(expense.getGroup(), members.get(requesterId), ActivityType.EXPENSE_UPDATED, null,
                expense.getDescription(), expense.getAmount());
        return mapToDTO(expense);
    }

    public List<ExpenseDTO> getGroupExpenses(Long groupId, Long requesterId) {
        groupAccess.requireMember(groupId, requesterId);
        return expenseRepository.findByGroup_IdOrderByCreatedAtDescIdDesc(groupId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteExpense(Long expenseId, Long requesterId) {
        Expense expense = findAccessibleExpense(expenseId, requesterId);
        activityService.record(expense.getGroup(), userRepository.getReferenceById(requesterId),
                ActivityType.EXPENSE_DELETED, null, expense.getDescription(), expense.getAmount());
        expenseRepository.delete(expense);
    }

    private Expense findAccessibleExpense(Long expenseId, Long requesterId) {
        return expenseRepository.findById(expenseId)
                .filter(e -> groupAccess.isMember(e.getGroup().getId(), requesterId))
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found"));
    }

    private Map<Long, User> membersById(Long groupId) {
        Map<Long, User> members = new LinkedHashMap<>();
        groupMemberRepository.findByGroup_Id(groupId).forEach(m -> members.put(m.getUser().getId(), m.getUser()));
        return members;
    }

    private void applyRequest(Expense expense, ExpenseRequest request, Map<Long, User> members) {
        User payer = members.get(request.getPaidBy());
        if (payer == null) {
            throw new IllegalArgumentException("Payer must be a member of the group");
        }
        SplitType splitType = request.getSplitType() == null ? SplitType.EQUAL : request.getSplitType();

        expense.setPaidBy(payer);
        expense.setDescription(request.getDescription().trim());
        expense.setAmount(request.getAmount());
        expense.setCategory(request.getCategory());
        expense.setSplitType(splitType);
        expense.getSplits().addAll(buildSplits(expense, splitType, request, members));
    }

    private List<ExpenseSplit> buildSplits(Expense expense, SplitType splitType, ExpenseRequest request,
                                           Map<Long, User> members) {
        List<ExpenseRequest.Share> shares = request.getSplits() == null ? List.of() : request.getSplits();
        Set<Long> seen = new HashSet<>();
        for (ExpenseRequest.Share share : shares) {
            if (!members.containsKey(share.getUserId())) {
                throw new IllegalArgumentException("Everyone in the split must be a member of the group");
            }
            if (!seen.add(share.getUserId())) {
                throw new IllegalArgumentException("Each member can appear only once in the split");
            }
        }

        Map<Long, BigDecimal> values = new LinkedHashMap<>();
        shares.forEach(share -> values.put(share.getUserId(), share.getValue()));

        Map<Long, BigDecimal> owed = switch (splitType) {
            case EQUAL -> SplitCalculator.equal(request.getAmount(),
                    shares.isEmpty() ? new ArrayList<>(members.keySet()) : new ArrayList<>(values.keySet()));
            case PERCENTAGE -> SplitCalculator.byPercentage(request.getAmount(), values);
            case EXACT -> SplitCalculator.exact(request.getAmount(), values);
        };

        List<ExpenseSplit> splits = new ArrayList<>();
        owed.forEach((userId, amountOwed) -> splits.add(ExpenseSplit.builder()
                .expense(expense)
                .user(members.get(userId))
                .amountOwed(amountOwed)
                .percentage(splitType == SplitType.PERCENTAGE
                        ? values.get(userId).setScale(2, RoundingMode.UNNECESSARY)
                        : null)
                .isSettled(false)
                .build()));
        return splits;
    }

    private ExpenseDTO mapToDTO(Expense expense) {
        List<ExpenseSplitDTO> splitDTOs = expense.getSplits() == null ? List.of() :
                expense.getSplits().stream()
                        .map(s -> ExpenseSplitDTO.builder()
                                .id(s.getId())
                                .userId(s.getUser().getId())
                                .userName(s.getUser().getName())
                                .amountOwed(s.getAmountOwed())
                                .percentage(s.getPercentage())
                                .isSettled(s.getIsSettled())
                                .build())
                        .collect(Collectors.toList());

        return ExpenseDTO.builder()
                .id(expense.getId())
                .groupId(expense.getGroup().getId())
                .paidByUserId(expense.getPaidBy().getId())
                .paidByName(expense.getPaidBy().getName())
                .description(expense.getDescription())
                .amount(expense.getAmount())
                .category(expense.getCategory())
                .splitType(expense.getSplitType() == null ? SplitType.EQUAL : expense.getSplitType())
                // createdAt was written with the server's zone; send an absolute instant to the browser
                .createdAt(expense.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant())
                .splits(splitDTOs)
                .build();
    }
}
