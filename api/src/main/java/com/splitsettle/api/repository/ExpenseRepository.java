package com.splitsettle.api.repository;

import com.splitsettle.api.entity.Expense;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    @EntityGraph(attributePaths = {"paidBy", "splits", "splits.user"})
    List<Expense> findByGroup_IdOrderByCreatedAtDescIdDesc(Long groupId);
}
