package com.splitsettle.api.controller;

import com.splitsettle.api.dto.ExpenseDTO;
import com.splitsettle.api.dto.ExpenseRequest;
import com.splitsettle.api.security.UserPrincipal;
import com.splitsettle.api.service.ExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {
    private final ExpenseService expenseService;

    @PostMapping
    public ResponseEntity<ExpenseDTO> addExpense(@Valid @RequestBody ExpenseRequest request,
                                                 @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(expenseService.addExpense(request, me.getId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ExpenseDTO> updateExpense(@PathVariable Long id,
                                                    @Valid @RequestBody ExpenseRequest request,
                                                    @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(expenseService.updateExpense(id, request, me.getId()));
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<List<ExpenseDTO>> getGroupExpenses(@PathVariable Long groupId,
                                                             @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(expenseService.getGroupExpenses(groupId, me.getId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteExpense(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal me) {
        expenseService.deleteExpense(id, me.getId());
        return ResponseEntity.ok().build();
    }
}
