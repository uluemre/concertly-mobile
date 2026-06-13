package com.concertly.backend.repository;

import com.concertly.backend.model.EventReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EventReviewRepository extends JpaRepository<EventReview, Long> {
    List<EventReview> findByEventIdOrderByCreatedAtDesc(Long eventId);
    Optional<EventReview> findByUserIdAndEventId(Long userId, Long eventId);
    int countByEventId(Long eventId);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM EventReview r WHERE r.event.id = :eventId")
    Double findAvgRatingByEventId(@Param("eventId") Long eventId);
}
