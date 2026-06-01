package com.concertly.backend.repository;

import com.concertly.backend.model.ConcertBuddy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConcertBuddyRepository extends JpaRepository<ConcertBuddy, Long> {
    List<ConcertBuddy> findByEventIdOrderByCreatedAtDesc(Long eventId);
    Optional<ConcertBuddy> findByUserIdAndEventId(Long userId, Long eventId);
    boolean existsByUserIdAndEventId(Long userId, Long eventId);
}
