package com.concertly.backend.repository;

import com.concertly.backend.model.EventReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventReviewRepository extends JpaRepository<EventReview, Long> {
    List<EventReview> findByEventIdOrderByCreatedAtDesc(Long eventId);
    Optional<EventReview> findByUserIdAndEventId(Long userId, Long eventId);
}
