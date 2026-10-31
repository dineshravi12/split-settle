package com.splitsettle.api.controller;

import com.splitsettle.api.dto.SettlementDTO;
import com.splitsettle.api.security.UserPrincipal;
import com.splitsettle.api.service.SettlementService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/settlements")
@RequiredArgsConstructor
public class SettlementController {
    private final SettlementService settlementService;

    @GetMapping("/{groupId}")
    public ResponseEntity<List<SettlementDTO>> calculateSettlements(@PathVariable Long groupId,
                                                                    @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(settlementService.calculateSettlements(groupId, me.getId()));
    }

    @PostMapping("/settle")
    public ResponseEntity<Void> settleUp(@Valid @RequestBody SettleRequest request,
                                         @AuthenticationPrincipal UserPrincipal me) {
        settlementService.settleUp(request.getGroupId(), request.getFromUserId(), request.getToUserId(), me.getId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{groupId}/settle-all")
    public ResponseEntity<SettleAllResponse> settleAll(@PathVariable Long groupId,
                                                       @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(new SettleAllResponse(settlementService.settleAllForUser(groupId, me.getId())));
    }

    public record SettleAllResponse(int settled) {}

    @lombok.Data
    public static class SettleRequest {
        @NotNull(message = "Group is required")
        private Long groupId;

        @NotNull(message = "Payer is required")
        private Long fromUserId;

        @NotNull(message = "Receiver is required")
        private Long toUserId;
    }
}
