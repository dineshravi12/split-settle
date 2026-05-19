package com.splitsettle.api.service;

import com.splitsettle.api.dto.ExpenseDTO;
import com.splitsettle.api.dto.ExpenseSplitDTO;
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
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {
    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public ExpenseDTO addExpense(Long groupId, String description, BigDecimal amount, String category, Long paidByUserId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        User payer = userRepository.findById(paidByUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!groupMemberRepository.existsByGroup_IdAndUser_Id(groupId, paidByUserId)) {
            throw new IllegalArgumentException("Payer must be a member of the group");
        }

        List<GroupMember> members = groupMemberRepository.findByGroup_Id(groupId);
        if (members.isEmpty()) {
            throw new IllegalArgumentException("Group has no members");
        }

        Expense expense = Expense.builder()
                .group(group)
                .paidBy(payer)
                .description(description)
                .amount(amount)
                .category(category)
                .build();

        expense = expenseRepository.save(expense);

        BigDecimal splitAmount = amount.divide(BigDecimal.valueOf(members.size()), 2, RoundingMode.HALF_UP);
        List<ExpenseSplit> splits = new ArrayList<>();

        for (GroupMember member : members) {
            ExpenseSplit split = ExpenseSplit.builder()
                    .expense(expense)
                    .user(member.getUser())
                    .amountOwed(splitAmount)
                    .isSettled(false)
                    .build();
            splits.add(split);
        }

        // Correct for rounding errors: the last person takes the remainder
        BigDecimal totalDistributed = splitAmount.multiply(BigDecimal.valueOf(members.size()));
        BigDecimal diff = amount.subtract(totalDistributed);
        if (diff.compareTo(BigDecimal.ZERO) != 0) {
            splits.get(splits.size() - 1).setAmountOwed(splits.get(splits.size() - 1).getAmountOwed().add(diff));
        }

        expenseSplitRepository.saveAll(splits);
        expense.setSplits(splits);

        return mapToDTO(expense);
    }

    public List<ExpenseDTO> getGroupExpenses(Long groupId) {
        return expenseRepository.findAll().stream()
                .filter(e -> e.getGroup().getId().equals(groupId))
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteExpense(Long expenseId) {
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found"));
        expenseRepository.delete(expense);
        // Splits are deleted by cascade
    }

    private ExpenseDTO mapToDTO(Expense expense) {
        List<ExpenseSplitDTO> splitDTOs = expense.getSplits() == null ? List.of() :
                expense.getSplits().stream()
                        .map(s -> ExpenseSplitDTO.builder()
                                .id(s.getId())
                                .userId(s.getUser().getId())
                                .userName(s.getUser().getName())
                                .amountOwed(s.getAmountOwed())
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
                .splits(splitDTOs)
                .build();
    }
}
