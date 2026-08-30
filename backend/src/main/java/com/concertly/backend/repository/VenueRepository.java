package com.concertly.backend.repository;

import com.concertly.backend.model.Venue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long> {
    Optional<Venue> findByExternalId(String externalId);
    Optional<Venue> findByNameAndCity(String name, String city);
    Optional<Venue> findFirstByNameAndCity(String name, String city);
}