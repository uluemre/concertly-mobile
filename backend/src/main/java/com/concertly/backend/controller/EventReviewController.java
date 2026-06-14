package com.concertly.backend.controller;

import com.concertly.backend.dto.response.EventReviewResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventReview;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.EventReviewRepository;
import com.concertly.backend.repository.EventVerificationRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events/{eventId}/reviews")
public class EventReviewController {

    private final EventReviewRepository reviewRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final EventAttendanceRepository attendanceRepository;
    private final EventVerificationRepository verificationRepository;

    public EventReviewController(EventReviewRepository reviewRepository,
                                 EventRepository eventRepository,
                                 UserRepository userRepository,
                                 EventAttendanceRepository attendanceRepository,
                                 EventVerificationRepository verificationRepository) {
        this.reviewRepository = reviewRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
        this.attendanceRepository = attendanceRepository;
        this.verificationRepository = verificationRepository;
    }

    /** Kullanıcı bu etkinliğe katıldı sayılır mı: "Gidiyorum" işaretledi veya konumla doğruladı. */
    private boolean hasAttended(Long userId, Long eventId) {
        if (verificationRepository.existsByUserIdAndEventId(userId, eventId)) return true;
        return attendanceRepository.findByUserIdAndEventId(userId, eventId)
                .map(a -> a.getStatus() == AttendanceStatus.GOING)
                .orElse(false);
    }

    @GetMapping
    public List<EventReviewResponse> getReviews(@PathVariable Long eventId) {
        return reviewRepository.findByEventIdOrderByCreatedAtDesc(eventId)
                .stream()
                .map(r -> EventReviewResponse.from(r,
                        r.getUser() != null && hasAttended(r.getUser().getId(), eventId)))
                .toList();
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

        // Yalnızca katılanlar değerlendirebilir (Gidiyorum işaretledi veya konumla doğruladı)
        if (!hasAttended(userId, eventId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Yalnızca bu konsere katılanlar değerlendirebilir");

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

        return EventReviewResponse.from(reviewRepository.save(review), true);
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
