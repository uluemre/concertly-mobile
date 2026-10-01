package com.concertly.backend.dto.response;

import com.concertly.backend.model.CommunityPostComment;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public class CommunityPostCommentResponse {

    private Long id;

    // B11: yalnızca yöneticilere gizli yorum döner (true)
    @JsonProperty("isHidden")
    private boolean isHidden;
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
        dto.isHidden = Boolean.TRUE.equals(c.getIsHidden());
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
    public boolean isHidden() { return isHidden; }
}
