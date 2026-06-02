package com.concertly.backend.repository;

import com.concertly.backend.model.EventVerification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventVerificationRepository extends JpaRepository<EventVerification, Long> {
    Optional<EventVerification> findByUserIdAndEventId(Long userId, Long eventId);
    boolean existsByUserIdAndEventId(Long userId, Long eventId);
    List<EventVerification> findByUserId(Long userId);
}
