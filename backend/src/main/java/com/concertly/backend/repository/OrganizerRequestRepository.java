package com.concertly.backend.repository;

import com.concertly.backend.model.OrganizerRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizerRequestRepository extends JpaRepository<OrganizerRequest, Long> {

    boolean existsByUserIdAndStatus(Long userId, OrganizerRequest.Status status);

    List<OrganizerRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    // En eski basvuru once — SLA takibi
    List<OrganizerRequest> findByStatusOrderByCreatedAtAsc(OrganizerRequest.Status status);
}
