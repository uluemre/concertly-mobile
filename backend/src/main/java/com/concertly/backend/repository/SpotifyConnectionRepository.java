package com.concertly.backend.repository;

import com.concertly.backend.model.SpotifyConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SpotifyConnectionRepository extends JpaRepository<SpotifyConnection, Long> {
    Optional<SpotifyConnection> findByUserId(Long userId);
}
