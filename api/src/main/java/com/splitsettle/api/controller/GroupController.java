package com.splitsettle.api.controller;

import com.splitsettle.api.dto.GroupDTO;
import com.splitsettle.api.security.UserPrincipal;
import com.splitsettle.api.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {
    private final GroupService groupService;

    private Long getCurrentUserId() {
        UserPrincipal principal = (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return principal.getId();
    }

    @PostMapping
    public ResponseEntity<GroupDTO> createGroup(@RequestBody GroupDTO groupRequest) {
        GroupDTO group = groupService.createGroup(groupRequest.getName(), getCurrentUserId());
        return ResponseEntity.ok(group);
    }

    @GetMapping
    public ResponseEntity<List<GroupDTO>> getMyGroups() {
        return ResponseEntity.ok(groupService.getUserGroups(getCurrentUserId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GroupDTO> getGroupById(@PathVariable Long id) {
        return ResponseEntity.ok(groupService.getGroupById(id));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<GroupDTO> addMember(@PathVariable Long id, @RequestBody GroupMemberRequest request) {
        return ResponseEntity.ok(groupService.addMemberByEmail(id, request.getEmail()));
    }

    @lombok.Data
    public static class GroupMemberRequest {
        private String email;
    }
}
