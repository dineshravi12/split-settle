package com.splitsettle.api.repository;

import com.splitsettle.api.entity.ExpenseSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, Long> {
    List<ExpenseSplit> findByExpense_Id(Long expenseId);
    List<ExpenseSplit> findByUser_Id(Long userId);
}
