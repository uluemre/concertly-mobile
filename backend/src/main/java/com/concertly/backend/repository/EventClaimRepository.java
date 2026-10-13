package com.concertly.backend.repository;

import com.concertly.backend.model.EventClaim;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EventClaimRepository extends JpaRepository<EventClaim, Long> {

    List<EventClaim> findByOrganizerIdOrderByCreatedAtDesc(Long organizerId);

    List<EventClaim> findByStatusOrderByCreatedAtAsc(EventClaim.Status status);

    boolean existsByEventIdAndOrganizerIdAndStatus(Long eventId, Long organizerId, EventClaim.Status status);

    List<EventClaim> findByEventIdAndStatus(Long eventId, EventClaim.Status status);
}
