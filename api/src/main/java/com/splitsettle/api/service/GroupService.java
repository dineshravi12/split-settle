package com.splitsettle.api.service;

import com.splitsettle.api.dto.GroupDTO;
import com.splitsettle.api.dto.GroupMemberDTO;
import com.splitsettle.api.entity.Group;
import com.splitsettle.api.entity.GroupMember;
import com.splitsettle.api.entity.User;
import com.splitsettle.api.exception.ResourceNotFoundException;
import com.splitsettle.api.repository.GroupMemberRepository;
import com.splitsettle.api.repository.GroupRepository;
import com.splitsettle.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public GroupDTO createGroup(String name, Long userId) {
        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Group group = Group.builder()
                .name(name)
                .createdBy(userId)
                .build();

        group = groupRepository.save(group);

        // Automatically add creator as first member
        GroupMember member = GroupMember.builder()
                .group(group)
                .user(creator)
                .build();
        groupMemberRepository.save(member);

        return mapToDTO(group);
    }

    public List<GroupDTO> getUserGroups(Long userId) {
        return groupRepository.findByMembers_UserId(userId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public GroupDTO getGroupById(Long groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
        return mapToDTO(group);
    }

    @Transactional
    public GroupDTO addMemberByEmail(Long groupId, String email) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));

        if (groupMemberRepository.existsByGroup_IdAndUser_Id(groupId, user.getId())) {
            throw new IllegalArgumentException("User is already a member of this group");
        }

        GroupMember member = GroupMember.builder()
                .group(group)
                .user(user)
                .build();
        groupMemberRepository.save(member);

        return mapToDTO(group);
    }

    private GroupDTO mapToDTO(Group group) {
        List<GroupMemberDTO> memberDTOs = group.getMembers() == null ? List.of() :
                group.getMembers().stream()
                        .map(m -> GroupMemberDTO.builder()
                                .userId(m.getUser().getId())
                                .name(m.getUser().getName())
                                .email(m.getUser().getEmail())
                                .build())
                        .collect(Collectors.toList());

        return GroupDTO.builder()
                .id(group.getId())
                .name(group.getName())
                .members(memberDTOs)
                .build();
    }
}
