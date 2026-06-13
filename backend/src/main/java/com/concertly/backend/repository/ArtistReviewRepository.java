package com.concertly.backend.repository;

import com.concertly.backend.model.ArtistReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ArtistReviewRepository extends JpaRepository<ArtistReview, Long> {
    List<ArtistReview> findByArtistIdOrderByCreatedAtDesc(Long artistId);
    Optional<ArtistReview> findByUserIdAndArtistId(Long userId, Long artistId);
    long countByArtistId(Long artistId);

    @Query("SELECT COALESCE(AVG(r.rating), 0.0) FROM ArtistReview r WHERE r.artist.id = :artistId")
    Double avgRatingByArtistId(@Param("artistId") Long artistId);
}
