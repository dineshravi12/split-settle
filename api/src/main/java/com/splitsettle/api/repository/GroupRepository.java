package com.splitsettle.api.repository;

import com.splitsettle.api.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupRepository extends JpaRepository<Group, Long> {
    java.util.List<Group> findByMembers_UserId(Long userId);
}
