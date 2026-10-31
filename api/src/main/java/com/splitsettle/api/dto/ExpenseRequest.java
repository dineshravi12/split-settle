package com.splitsettle.api.dto;

import com.splitsettle.api.entity.SplitType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ExpenseRequest {
    @NotNull(message = "Group is required")
    private Long groupId;

    @NotBlank(message = "Description is required")
    @Size(max = 255, message = "Description must be at most 255 characters")
    private String description;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    @Digits(integer = 8, fraction = 2, message = "Amount can have at most 2 decimal places")
    private BigDecimal amount;

    @Size(max = 50, message = "Category must be at most 50 characters")
    private String category;

    @NotNull(message = "Payer is required")
    private Long paidBy;

    /** Defaults to EQUAL. */
    private SplitType splitType;

    /** EQUAL: optional participant subset (all members if empty). PERCENTAGE / EXACT: value per member. */
    @Valid
    private List<Share> splits;

    @Data
    public static class Share {
        @NotNull(message = "Split member is required")
        private Long userId;

        @DecimalMin(value = "0.01", message = "Split values must be greater than zero")
        @Digits(integer = 8, fraction = 2, message = "Split values can have at most 2 decimal places")
        private BigDecimal value;
    }
}
