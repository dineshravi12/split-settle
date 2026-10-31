package com.splitsettle.api.repository;

import com.splitsettle.api.entity.Payment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    @EntityGraph(attributePaths = {"fromUser", "toUser"})
    List<Payment> findByGroup_Id(Long groupId);
}
