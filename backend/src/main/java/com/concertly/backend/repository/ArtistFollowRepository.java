package com.concertly.backend.repository;

import com.concertly.backend.model.ArtistFollow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ArtistFollowRepository extends JpaRepository<ArtistFollow, Long> {
    Optional<ArtistFollow> findByUserIdAndArtistId(Long userId, Long artistId);
    long countByArtistId(Long artistId);
}