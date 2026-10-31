package com.splitsettle.api.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupDTO {
    private Long id;
    private String name;
    private BigDecimal budget;
    private List<GroupMemberDTO> members;
}
