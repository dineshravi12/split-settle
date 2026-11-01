package com.splitsettle.api.service;

import com.splitsettle.api.dto.ActivityDTO;
import com.splitsettle.api.entity.Activity;
import com.splitsettle.api.entity.ActivityType;
import com.splitsettle.api.entity.Group;
import com.splitsettle.api.entity.User;
import com.splitsettle.api.realtime.GroupActivityEvent;
import com.splitsettle.api.repository.ActivityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivityService {
    private final ActivityRepository activityRepository;
    private final GroupAccessService groupAccess;
    private final ApplicationEventPublisher events;

    public void record(Group group, User actor, ActivityType type, User target, String description, BigDecimal amount) {
        Activity activity = activityRepository.save(Activity.builder()
                .group(group)
                .actor(actor)
                .type(type)
                .targetUser(target)
                .description(description)
                .amount(amount)
                .build());
        events.publishEvent(new GroupActivityEvent(group.getId(), toDTO(activity)));
    }

    @Transactional(readOnly = true)
    public List<ActivityDTO> getGroupActivity(Long groupId, Long requesterId) {
        groupAccess.requireMember(groupId, requesterId);
        return activityRepository.findTop50ByGroup_IdOrderByIdDesc(groupId).stream()
                .map(this::toDTO)
                .toList();
    }

    private ActivityDTO toDTO(Activity a) {
        return ActivityDTO.builder()
                .id(a.getId())
                .type(a.getType())
                .actorId(a.getActor().getId())
                .actorName(a.getActor().getName())
                .targetId(a.getTargetUser() == null ? null : a.getTargetUser().getId())
                .targetName(a.getTargetUser() == null ? null : a.getTargetUser().getName())
                .description(a.getDescription())
                .amount(a.getAmount())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
