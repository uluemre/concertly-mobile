package com.concertly.backend.dto.response;

import com.concertly.backend.model.CommunityPostComment;

import java.time.LocalDateTime;

public class CommunityPostCommentResponse {

    private Long id;
    private String content;
    private LocalDateTime createdAt;
    private Long userId;
    private String username;
    private String userProfileImageUrl;

    public static CommunityPostCommentResponse from(CommunityPostComment c) {
        CommunityPostCommentResponse dto = new CommunityPostCommentResponse();
        dto.id = c.getId();
        dto.content = c.getContent();
        dto.createdAt = c.getCreatedAt();
        if (c.getUser() != null) {
            dto.userId = c.getUser().getId();
            dto.username = c.getUser().getUsername();
            dto.userProfileImageUrl = c.getUser().getProfileImageUrl();
        }
        return dto;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getUserProfileImageUrl() { return userProfileImageUrl; }
}
