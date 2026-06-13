package com.concertly.backend.controller;

import com.concertly.backend.dto.response.ArtistReviewResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.ArtistReview;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.ArtistReviewRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/artists/{artistId}/reviews")
public class ArtistReviewController {

    private final ArtistReviewRepository reviewRepository;
    private final ArtistRepository artistRepository;
    private final UserRepository userRepository;

    public ArtistReviewController(ArtistReviewRepository reviewRepository,
                                  ArtistRepository artistRepository,
                                  UserRepository userRepository) {
        this.reviewRepository = reviewRepository;
        this.artistRepository = artistRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<ArtistReviewResponse> getReviews(@PathVariable Long artistId) {
        return reviewRepository.findByArtistIdOrderByCreatedAtDesc(artistId)
                .stream().map(ArtistReviewResponse::from).toList();
    }

    @PostMapping
    @Transactional
    public ArtistReviewResponse upsertReview(
            @PathVariable Long artistId,
            @RequestBody Map<String, Object> body
    ) {
        Long userId = JwtUtil.getCurrentUserId();
        int rating = ((Number) body.get("rating")).intValue();
        String comment = (String) body.getOrDefault("comment", null);

        if (rating < 1 || rating > 5)
            throw new IllegalArgumentException("Puan 1-5 arasında olmalı");

        Artist artist = artistRepository.findById(artistId)
                .orElseThrow(() -> new ResourceNotFoundException("Sanatçı bulunamadı: " + artistId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));

        ArtistReview review = reviewRepository.findByUserIdAndArtistId(userId, artistId)
                .orElse(new ArtistReview());

        review.setUser(user);
        review.setArtist(artist);
        review.setRating(rating);
        review.setComment(comment != null && !comment.isBlank() ? comment.trim() : null);

        return ArtistReviewResponse.from(reviewRepository.save(review));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteReview(@PathVariable Long artistId) {
        Long userId = JwtUtil.getCurrentUserId();
        reviewRepository.findByUserIdAndArtistId(userId, artistId)
                .ifPresent(reviewRepository::delete);
    }
}
