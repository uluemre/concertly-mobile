package com.concertly.backend.repository;

import com.concertly.backend.model.VenueReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VenueReviewRepository extends JpaRepository<VenueReview, Long> {
    List<VenueReview> findByVenueIdOrderByCreatedAtDesc(Long venueId);
    Optional<VenueReview> findByUserIdAndVenueId(Long userId, Long venueId);
    long countByVenueId(Long venueId);

    @Query("SELECT COALESCE(AVG(r.rating), 0.0) FROM VenueReview r WHERE r.venue.id = :venueId")
    Double avgRatingByVenueId(@Param("venueId") Long venueId);
}
