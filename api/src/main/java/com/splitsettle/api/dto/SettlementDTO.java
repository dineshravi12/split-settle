package com.splitsettle.api.dto;

import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SettlementDTO {
    private String from;
    private Long fromId;
    private String to;
    private Long toId;
    private BigDecimal amount;
}
