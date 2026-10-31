package com.splitsettle.api.service;

import com.splitsettle.api.exception.ResourceNotFoundException;
import com.splitsettle.api.repository.GroupMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GroupAccessService {
    private final GroupMemberRepository groupMemberRepository;

    public boolean isMember(Long groupId, Long userId) {
        return groupId != null && userId != null
                && groupMemberRepository.existsByGroup_IdAndUser_Id(groupId, userId);
    }

    // 404 rather than 403 so non-members can't probe which group ids exist
    public void requireMember(Long groupId, Long userId) {
        if (!isMember(groupId, userId)) {
            throw new ResourceNotFoundException("Group not found");
        }
    }
}
