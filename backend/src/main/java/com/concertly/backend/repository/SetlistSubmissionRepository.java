package com.concertly.backend.repository;

import com.concertly.backend.model.SetlistSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SetlistSubmissionRepository extends JpaRepository<SetlistSubmission, Long> {

    Optional<SetlistSubmission> findByUserIdAndEventIdAndKind(Long userId, Long eventId, String kind);

    List<SetlistSubmission> findByEventIdAndKind(Long eventId, String kind);

    long countByEventIdAndKind(Long eventId, String kind);
}
