package com.concertly.backend.repository;

import com.concertly.backend.model.OrganizerFollow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizerFollowRepository extends JpaRepository<OrganizerFollow, Long> {

    Optional<OrganizerFollow> findByOrganizerIdAndUserId(Long organizerId, Long userId);

    long countByOrganizerId(Long organizerId);

    List<OrganizerFollow> findByOrganizerId(Long organizerId);
}
