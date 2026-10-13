package com.concertly.backend.repository;

import com.concertly.backend.model.OrganizerAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface OrganizerAnnouncementRepository extends JpaRepository<OrganizerAnnouncement, Long> {

    List<OrganizerAnnouncement> findByEventIdOrderByCreatedAtDesc(Long eventId);

    boolean existsByEventIdAndCreatedAtAfter(Long eventId, LocalDateTime after);
}
