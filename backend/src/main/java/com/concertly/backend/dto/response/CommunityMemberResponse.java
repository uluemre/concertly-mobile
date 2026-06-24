package com.concertly.backend.dto.response;

import com.concertly.backend.model.CommunityMember;

import java.time.LocalDateTime;

public class CommunityMemberResponse {

    private Long userId;
    private String username;
    private String profileImageUrl;
    private String role;    // OWNER | MODERATOR | MEMBER
    private String status;  // ACTIVE | PENDING | INVITED | BANNED
    private LocalDateTime joinedAt;

    public static CommunityMemberResponse from(CommunityMember m) {
        CommunityMemberResponse dto = new CommunityMemberResponse();
        dto.userId = m.getUser().getId();
        dto.username = m.getUser().getUsername();
        dto.profileImageUrl = m.getUser().getProfileImageUrl();
        dto.role = m.getRole();
        dto.status = m.getStatus();
        dto.joinedAt = m.getJoinedAt();
        return dto;
    }

    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getProfileImageUrl() { return profileImageUrl; }
    public String getRole() { return role; }
    public String getStatus() { return status; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
}
