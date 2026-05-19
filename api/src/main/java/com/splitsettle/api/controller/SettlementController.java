package com.splitsettle.api.controller;

import com.splitsettle.api.dto.SettlementDTO;
import com.splitsettle.api.service.SettlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/settlements")
@RequiredArgsConstructor
public class SettlementController {
    private final SettlementService settlementService;

    @GetMapping("/{groupId}")
    public ResponseEntity<List<SettlementDTO>> calculateSettlements(@PathVariable Long groupId) {
        return ResponseEntity.ok(settlementService.calculateSettlements(groupId));
    }

    @PostMapping("/settle")
    public ResponseEntity<Void> settleUp(@RequestBody SettleRequest request) {
        settlementService.settleUp(request.getGroupId(), request.getFromUserId(), request.getToUserId());
        return ResponseEntity.ok().build();
    }

    @lombok.Data
    public static class SettleRequest {
        private Long groupId;
        private Long fromUserId;
        private Long toUserId;
    }
}
