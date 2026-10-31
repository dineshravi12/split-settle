package com.splitsettle.api.dto;

import com.splitsettle.api.entity.ActivityType;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActivityDTO {
    private Long id;
    private ActivityType type;
    private Long actorId;
    private String actorName;
    private Long targetId;
    private String targetName;
    private String description;
    private BigDecimal amount;
    private Instant createdAt;
}
