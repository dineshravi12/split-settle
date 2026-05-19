package com.splitsettle.api.repository;

import com.splitsettle.api.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    List<GroupMember> findByGroup_Id(Long groupId);
    Optional<GroupMember> findByGroup_IdAndUser_Id(Long groupId, Long userId);
    boolean existsByGroup_IdAndUser_Id(Long groupId, Long userId);
}
