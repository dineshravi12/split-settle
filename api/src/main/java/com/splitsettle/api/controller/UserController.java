package com.splitsettle.api.controller;

import com.splitsettle.api.dto.UpdateProfileRequest;
import com.splitsettle.api.dto.UserProfileDTO;
import com.splitsettle.api.security.UserPrincipal;
import com.splitsettle.api.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserProfileDTO> getMe(@AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(userService.getProfile(me.getId()));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileDTO> updateMe(@Valid @RequestBody UpdateProfileRequest request,
                                                   @AuthenticationPrincipal UserPrincipal me) {
        return ResponseEntity.ok(userService.updateProfile(me.getId(), request));
    }
}
