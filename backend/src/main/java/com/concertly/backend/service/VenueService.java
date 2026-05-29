package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreateVenueReviewRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.VenueDetailResponse;
import com.concertly.backend.dto.response.VenueReviewResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class VenueService {

    private final VenueRepository venueRepository;
    private final VenueReviewRepository reviewRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    public VenueService(VenueRepository venueRepository,
                        VenueReviewRepository reviewRepository,
                        EventRepository eventRepository,
                        UserRepository userRepository) {
        this.venueRepository = venueRepository;
        this.reviewRepository = reviewRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
    }

    public VenueDetailResponse getVenue(Long venueId, Long currentUserId) {
        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> new ResourceNotFoundException("Mekan bulunamadı: " + venueId));

        Double avgRating = reviewRepository.avgRatingByVenueId(venueId);
        long reviewCount = reviewRepository.countByVenueId(venueId);
        long totalEvents = eventRepository.findByVenueIdOrderByEventDateAsc(venueId).size();

        Integer myRating = null;
        if (currentUserId != null) {
            myRating = reviewRepository.findByUserIdAndVenueId(currentUserId, venueId)
                    .map(VenueReview::getRating).orElse(null);
        }

        return VenueDetailResponse.from(venue, avgRating, reviewCount, totalEvents, myRating);
    }

    public List<EventResponse> getVenueEvents(Long venueId) {
        return eventRepository.findByVenueIdOrderByEventDateAsc(venueId)
                .stream()
                .map(EventResponse::from)
                .toList();
    }

    public List<VenueReviewResponse> getReviews(Long venueId) {
        return reviewRepository.findByVenueIdOrderByCreatedAtDesc(venueId)
                .stream()
                .map(VenueReviewResponse::from)
                .toList();
    }

    @Transactional
    public VenueReviewResponse addReview(Long venueId, Long userId, CreateVenueReviewRequest req) {
        if (req.getRating() == null || req.getRating() < 1 || req.getRating() > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Puan 1-5 arasında olmalı.");
        }

        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> new ResourceNotFoundException("Mekan bulunamadı: " + venueId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        VenueReview review = reviewRepository.findByUserIdAndVenueId(userId, venueId)
                .orElse(new VenueReview());
        review.setUser(user);
        review.setVenue(venue);
        review.setRating(req.getRating());
        review.setComment(req.getComment());

        return VenueReviewResponse.from(reviewRepository.save(review));
    }

    @Transactional
    public void deleteReview(Long reviewId, Long userId) {
        VenueReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Yorum bulunamadı."));
        if (!review.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu yorumu silemezsiniz.");
        }
        reviewRepository.delete(review);
    }
}
