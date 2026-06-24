package com.concertly.backend.dto.response;

import com.concertly.backend.model.Community;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class CommunityResponse {

    private Long id;
    private String name;
    private String type;
    private String city;
    private String emoji;
    private String gradientStart;
    private String gradientEnd;
    private String description;
    private String nextEvent;
    private List<String> tags;
    private Boolean live;
    private long memberCount;
    private long postCount;

    private String visibility;       // PUBLIC | PRIVATE | SECRET
    private String approvalStatus;   // PENDING | APPROVED | REJECTED
    private LocalDateTime createdAt;

    private Long ownerId;
    private String ownerUsername;
    private String ownerProfileImageUrl;

    // İstek atan kullanıcıya göre durum
    private String currentUserRole;    // OWNER | MODERATOR | MEMBER | null
    private String currentUserStatus;  // ACTIVE | PENDING | INVITED | BANNED | null

    @JsonProperty("isJoinedByCurrentUser")
    private boolean isJoinedByCurrentUser;

    @JsonProperty("canManage")
    private boolean canManage;

    // Sadece yöneticilere (owner/mod) doldurulur
    private String inviteCode;
    private Long pendingRequestCount;

    public static CommunityResponse from(Community community,
                                          long memberCount,
                                          long postCount,
                                          String currentUserRole,
                                          String currentUserStatus,
                                          Long pendingRequestCount) {
        CommunityResponse dto = new CommunityResponse();
        dto.id = community.getId();
        dto.name = community.getName();
        dto.type = community.getType();
        dto.city = community.getCity();
        dto.emoji = community.getEmoji();
        dto.gradientStart = community.getGradientStart();
        dto.gradientEnd = community.getGradientEnd();
        dto.description = community.getDescription();
        dto.nextEvent = community.getNextEvent();
        dto.live = community.getLive();
        dto.memberCount = memberCount;
        dto.postCount = postCount;

        // Eski/seed kayıtlarında null olabilir → güvenli varsayılan
        dto.visibility = community.getVisibility() != null ? community.getVisibility() : "PUBLIC";
        dto.approvalStatus = community.getApprovalStatus() != null ? community.getApprovalStatus() : "APPROVED";
        dto.createdAt = community.getCreatedAt();

        if (community.getOwner() != null) {
            dto.ownerId = community.getOwner().getId();
            dto.ownerUsername = community.getOwner().getUsername();
            dto.ownerProfileImageUrl = community.getOwner().getProfileImageUrl();
        }

        dto.currentUserRole = currentUserRole;
        dto.currentUserStatus = currentUserStatus;
        dto.isJoinedByCurrentUser = "ACTIVE".equals(currentUserStatus);
        dto.canManage = "OWNER".equals(currentUserRole) || "MODERATOR".equals(currentUserRole);

        if (dto.canManage) {
            dto.inviteCode = community.getInviteCode();
            dto.pendingRequestCount = pendingRequestCount;
        }

        if (community.getTags() != null && !community.getTags().isBlank()) {
            dto.tags = Arrays.asList(community.getTags().split(","));
        } else {
            dto.tags = Collections.emptyList();
        }

        return dto;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getType() { return type; }
    public String getCity() { return city; }
    public String getEmoji() { return emoji; }
    public String getGradientStart() { return gradientStart; }
    public String getGradientEnd() { return gradientEnd; }
    public String getDescription() { return description; }
    public String getNextEvent() { return nextEvent; }
    public List<String> getTags() { return tags; }
    public Boolean getLive() { return live; }
    public long getMemberCount() { return memberCount; }
    public long getPostCount() { return postCount; }
    public String getVisibility() { return visibility; }
    public String getApprovalStatus() { return approvalStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getOwnerId() { return ownerId; }
    public String getOwnerUsername() { return ownerUsername; }
    public String getOwnerProfileImageUrl() { return ownerProfileImageUrl; }
    public String getCurrentUserRole() { return currentUserRole; }
    public String getCurrentUserStatus() { return currentUserStatus; }
    public boolean isJoinedByCurrentUser() { return isJoinedByCurrentUser; }
    public boolean isCanManage() { return canManage; }
    public String getInviteCode() { return inviteCode; }
    public Long getPendingRequestCount() { return pendingRequestCount; }
}
