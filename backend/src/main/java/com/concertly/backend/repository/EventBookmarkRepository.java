package com.concertly.backend.repository;

import com.concertly.backend.model.EventBookmark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventBookmarkRepository extends JpaRepository<EventBookmark, Long> {
    Optional<EventBookmark> findByUserIdAndEventId(Long userId, Long eventId);
    boolean existsByUserIdAndEventId(Long userId, Long eventId);
    List<EventBookmark> findAllByUserIdOrderByCreatedAtDesc(Long userId);
}
