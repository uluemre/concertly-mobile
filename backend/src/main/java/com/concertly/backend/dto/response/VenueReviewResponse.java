package com.concertly.backend.dto.response;

import com.concertly.backend.model.VenueReview;
import java.time.LocalDateTime;

public class VenueReviewResponse {
    private Long id;
    private Long userId;
    private String username;
    private String profileImageUrl;
    private Integer rating;
    private String comment;
    private LocalDateTime createdAt;

    public static VenueReviewResponse from(VenueReview r) {
        VenueReviewResponse dto = new VenueReviewResponse();
        dto.id = r.getId();
        dto.userId = r.getUser().getId();
        dto.username = r.getUser().getUsername();
        dto.profileImageUrl = r.getUser().getProfileImageUrl();
        dto.rating = r.getRating();
        dto.comment = r.getComment();
        dto.createdAt = r.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getProfileImageUrl() { return profileImageUrl; }
    public Integer getRating() { return rating; }
    public String getComment() { return comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
