package com.concertly.backend.repository;

import com.concertly.backend.model.EventReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface EventReviewRepository extends JpaRepository<EventReview, Long> {
    List<EventReview> findByEventIdOrderByCreatedAtDesc(Long eventId);
    Optional<EventReview> findByUserIdAndEventId(Long userId, Long eventId);
    int countByEventId(Long eventId);

    @Query("SELECT AVG(r.rating) FROM EventReview r WHERE r.event.id = :eventId")
    Double findAvgRatingByEventId(@Param("eventId") Long eventId);

    // Toplu puan istatistiği — (eventId, count, avgRating) — liste endpoint'lerinde N+1'i önler
    @Query("SELECT r.event.id, COUNT(r), AVG(r.rating) FROM EventReview r WHERE r.event.id IN :eventIds GROUP BY r.event.id")
    List<Object[]> findRatingStatsByEventIdIn(@Param("eventIds") Collection<Long> eventIds);
}
