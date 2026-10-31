package com.splitsettle.api.repository;

import com.splitsettle.api.entity.ExpenseSplit;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, Long> {
    List<ExpenseSplit> findByExpense_Id(Long expenseId);
    List<ExpenseSplit> findByUser_Id(Long userId);

    @EntityGraph(attributePaths = {"user", "expense", "expense.paidBy"})
    List<ExpenseSplit> findByExpense_Group_Id(Long groupId);
}
