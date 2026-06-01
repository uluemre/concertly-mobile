package com.concertly.backend.controller;

import com.concertly.backend.dto.response.EventReviewResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventReview;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventReviewRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events/{eventId}/reviews")
public class EventReviewController {

    private final EventReviewRepository reviewRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    public EventReviewController(EventReviewRepository reviewRepository,
                                 EventRepository eventRepository,
                                 UserRepository userRepository) {
        this.reviewRepository = reviewRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<EventReviewResponse> getReviews(@PathVariable Long eventId) {
        return reviewRepository.findByEventIdOrderByCreatedAtDesc(eventId)
                .stream().map(EventReviewResponse::from).toList();
    }

    @PostMapping
    @Transactional
    public EventReviewResponse upsertReview(
            @PathVariable Long eventId,
            @RequestBody Map<String, Object> body
    ) {
        Long userId = JwtUtil.getCurrentUserId();
        int rating = ((Number) body.get("rating")).intValue();
        String comment = (String) body.getOrDefault("comment", null);

        if (rating < 1 || rating > 5)
            throw new IllegalArgumentException("Puan 1-5 arasında olmalı");

        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        EventReview review = reviewRepository.findByUserIdAndEventId(userId, eventId)
                .orElse(new EventReview());

        review.setUser(user);
        review.setEvent(event);
        review.setRating(rating);
        review.setComment(comment != null && !comment.isBlank() ? comment.trim() : null);

        return EventReviewResponse.from(reviewRepository.save(review));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteReview(@PathVariable Long eventId) {
        Long userId = JwtUtil.getCurrentUserId();
        reviewRepository.findByUserIdAndEventId(userId, eventId)
                .ifPresent(reviewRepository::delete);
    }
}
