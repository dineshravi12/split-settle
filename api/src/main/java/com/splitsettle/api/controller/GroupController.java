package com.splitsettle.api.controller;

import com.splitsettle.api.dto.ActivityDTO;
import com.splitsettle.api.dto.GroupDTO;
import com.splitsettle.api.security.UserPrincipal;
import com.splitsettle.api.service.ActivityService;
import com.splitsettle.api.service.GroupService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {
    private final GroupService groupService;
    private final ActivityService activityService;

    @PostMapping
    public ResponseEntity<GroupDTO> createGroup(@Valid @RequestBody CreateGroupRequest request,
                                                @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(groupService.createGroup(request.getName(), me.getId()));
    }

    @GetMapping
    public ResponseEntity<List<GroupDTO>> getMyGroups(@AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(groupService.getUserGroups(me.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GroupDTO> getGroupById(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(groupService.getGroupById(id, me.getId()));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<GroupDTO> addMember(@PathVariable Long id,
                                              @Valid @RequestBody GroupMemberRequest request,
                                              @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(groupService.addMemberByEmail(id, request.getEmail(), me.getId()));
    }

    @GetMapping("/{id}/activity")
    public ResponseEntity<List<ActivityDTO>> getActivity(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(activityService.getGroupActivity(id, me.getId()));
    }

    @lombok.Data
    public static class CreateGroupRequest {
        @NotBlank(message = "Group name is required")
        @Size(max = 100, message = "Group name must be at most 100 characters")
        private String name;
    }

    @lombok.Data
    public static class GroupMemberRequest {
        @NotBlank(message = "Email is required")
        @Email(message = "Email should be valid")
        private String email;
    }
}
