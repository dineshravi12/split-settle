package com.splitsettle.api.dto;

import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpenseSplitDTO {
    private Long id;
    private Long userId;
    private String userName;
    private BigDecimal amountOwed;
    private Boolean isSettled;
}
