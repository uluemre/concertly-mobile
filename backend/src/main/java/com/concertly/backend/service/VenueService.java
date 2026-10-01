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
        // Birlestirilmis (eski) kimlikle gelen istek ASIL mekani doner; yanitin id alani asil kimliktir (N-08)
        Venue venue = MergePointers.canonical(venueRepository.findById(venueId), venueRepository)
                .orElseThrow(() -> new ResourceNotFoundException("Mekan bulunamadı: " + venueId));
        Long canonicalId = venue.getId();

        Double avgRating = reviewRepository.avgRatingByVenueId(canonicalId);
        long reviewCount = reviewRepository.countByVenueId(canonicalId);
        // Sayı, listedeki kartlarla aynı olsun (N-33): aynı konserin kaynak kopyaları tek sayılır
        long totalEvents = collapseCopies(eventRepository.findByVenueIdOrderByEventDateAsc(canonicalId).stream()
                .filter(com.concertly.backend.model.Event::listedPublicly)
                .toList()).size();

        Integer myRating = null;
        if (currentUserId != null) {
            myRating = reviewRepository.findByUserIdAndVenueId(currentUserId, canonicalId)
                    .map(VenueReview::getRating).orElse(null);
        }

        return VenueDetailResponse.from(venue, avgRating, reviewCount, totalEvents, myRating);
    }

    // Ayni konserin kopyalari (Biletix + Biletinial...) listede tek kart olsun.
    // Alan enjeksiyonu: kurucu ve onu kullanan testler degismesin; yoksa liste aynen doner.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.concertly.backend.service.ingest.ConcertGrouping concertGrouping;

    private List<com.concertly.backend.model.Event> collapseCopies(List<com.concertly.backend.model.Event> events) {
        return concertGrouping == null ? events : concertGrouping.collapse(events);
    }

    /** Birlestirilmis (eski) mekan kimligi gelirse ASIL mekanin kimligi (N-08); bulunamazsa aynen (bos liste). */
    private Long canonicalVenueId(Long venueId) {
        Venue found = venueRepository.findById(venueId).orElse(null);
        return found == null ? venueId : MergePointers.rootOf(found, venueRepository).getId();
    }

    public List<EventResponse> getVenueEvents(Long venueId) {
        return collapseCopies(eventRepository.findByVenueIdOrderByEventDateAsc(canonicalVenueId(venueId))
                .stream()
                .filter(com.concertly.backend.model.Event::listedPublicly)
                .toList())
                .stream()
                .map(EventResponse::from)
                .toList();
    }

    public List<VenueReviewResponse> getReviews(Long venueId) {
        return reviewRepository.findByVenueIdOrderByCreatedAtDesc(canonicalVenueId(venueId))
                .stream()
                .map(VenueReviewResponse::from)
                .toList();
    }

    @Transactional
    public VenueReviewResponse addReview(Long venueId, Long userId, CreateVenueReviewRequest req) {
        if (req.getRating() == null || req.getRating() < 1 || req.getRating() > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Puan 1-5 arasında olmalı.");
        }

        Venue venue = MergePointers.canonical(venueRepository.findById(venueId), venueRepository)
                .orElseThrow(() -> new ResourceNotFoundException("Mekan bulunamadı: " + venueId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        VenueReview review = reviewRepository.findByUserIdAndVenueId(userId, venue.getId())
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
