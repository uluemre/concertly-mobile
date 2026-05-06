package com.concertly.backend.repository;

import com.concertly.backend.model.Venue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long> {
    Optional<Venue> findByExternalId(String externalId);
}