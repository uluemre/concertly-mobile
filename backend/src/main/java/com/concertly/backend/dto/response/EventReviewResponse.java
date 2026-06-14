package com.concertly.backend.dto.response;

import com.concertly.backend.model.EventReview;
import java.time.LocalDateTime;

public class EventReviewResponse {

    private Long id;
    private Long userId;
    private String username;
    private String userProfileImageUrl;
    private Integer rating;
    private String comment;
    private LocalDateTime createdAt;
    private boolean attended;

    public static EventReviewResponse from(EventReview r) {
        return from(r, false);
    }

    public static EventReviewResponse from(EventReview r, boolean attended) {
        EventReviewResponse dto = new EventReviewResponse();
        dto.id = r.getId();
        dto.rating = r.getRating();
        dto.comment = r.getComment();
        dto.createdAt = r.getCreatedAt();
        dto.attended = attended;
        if (r.getUser() != null) {
            dto.userId = r.getUser().getId();
            dto.username = r.getUser().getUsername();
            dto.userProfileImageUrl = r.getUser().getProfileImageUrl();
        }
        return dto;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getUserProfileImageUrl() { return userProfileImageUrl; }
    public Integer getRating() { return rating; }
    public String getComment() { return comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isAttended() { return attended; }
}
