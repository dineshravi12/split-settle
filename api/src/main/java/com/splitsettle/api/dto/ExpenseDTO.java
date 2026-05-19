package com.splitsettle.api.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpenseDTO {
    private Long id;
    private Long groupId;
    private Long paidByUserId;
    private String paidByName;
    private String description;
    private BigDecimal amount;
    private String category;
    private List<ExpenseSplitDTO> splits;
}
