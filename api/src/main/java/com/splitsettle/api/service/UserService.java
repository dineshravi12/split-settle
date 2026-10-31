package com.splitsettle.api.service;

import com.splitsettle.api.dto.UpdateProfileRequest;
import com.splitsettle.api.dto.UserProfileDTO;
import com.splitsettle.api.entity.User;
import com.splitsettle.api.exception.ResourceNotFoundException;
import com.splitsettle.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    public UserProfileDTO getProfile(Long userId) {
        return toDTO(findUser(userId));
    }

    @Transactional
    public UserProfileDTO updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findUser(userId);
        user.setUpiId(request.getUpiId());
        return toDTO(userRepository.save(user));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private static UserProfileDTO toDTO(User user) {
        return UserProfileDTO.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .upiId(user.getUpiId())
                .memberSince(user.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant())
                .build();
    }
}
