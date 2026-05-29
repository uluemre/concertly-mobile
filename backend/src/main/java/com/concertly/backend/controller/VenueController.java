package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateVenueReviewRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.VenueDetailResponse;
import com.concertly.backend.dto.response.VenueReviewResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.VenueService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/venues")
public class VenueController {

    private final VenueService venueService;
    private final JwtUtil jwtUtil;

    public VenueController(VenueService venueService, JwtUtil jwtUtil) {
        this.venueService = venueService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping("/{id}")
    public VenueDetailResponse getVenue(@PathVariable Long id) {
        Long currentUserId = jwtUtil.getCurrentUserId();
        return venueService.getVenue(id, currentUserId);
    }

    @GetMapping("/{id}/events")
    public List<EventResponse> getVenueEvents(@PathVariable Long id) {
        return venueService.getVenueEvents(id);
    }

    @GetMapping("/{id}/reviews")
    public List<VenueReviewResponse> getReviews(@PathVariable Long id) {
        return venueService.getReviews(id);
    }

    @PostMapping("/{id}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public VenueReviewResponse addReview(
            @PathVariable Long id,
            @RequestBody CreateVenueReviewRequest request) {
        Long userId = jwtUtil.getCurrentUserId();
        return venueService.addReview(id, userId, request);
    }

    @DeleteMapping("/{id}/reviews/{reviewId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(@PathVariable Long id, @PathVariable Long reviewId) {
        Long userId = jwtUtil.getCurrentUserId();
        venueService.deleteReview(reviewId, userId);
    }
}
