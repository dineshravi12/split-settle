package com.splitsettle.api.repository;

import com.splitsettle.api.entity.Activity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityRepository extends JpaRepository<Activity, Long> {
    @EntityGraph(attributePaths = {"actor", "targetUser"})
    List<Activity> findTop50ByGroup_IdOrderByIdDesc(Long groupId);
}
