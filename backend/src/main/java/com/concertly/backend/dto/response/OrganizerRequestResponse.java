package com.concertly.backend.dto.response;

import com.concertly.backend.model.OrganizerRequest;

import java.time.LocalDateTime;

public class OrganizerRequestResponse {

    private Long id;
    private Long userId;
    private String username;
    private String organizationName;
    private String type;
    private String website;
    private String instagram;
    private String message;
    private String status;
    private String reviewNote;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;

    public static OrganizerRequestResponse from(OrganizerRequest r) {
        OrganizerRequestResponse dto = new OrganizerRequestResponse();
        dto.id = r.getId();
        dto.userId = r.getUser() != null ? r.getUser().getId() : null;
        dto.username = r.getUser() != null ? r.getUser().getUsername() : null;
        dto.organizationName = r.getOrganizationName();
        dto.type = r.getType().name();
        dto.website = r.getWebsite();
        dto.instagram = r.getInstagram();
        dto.message = r.getMessage();
        dto.status = r.getStatus().name();
        dto.reviewNote = r.getReviewNote();
        dto.createdAt = r.getCreatedAt();
        dto.reviewedAt = r.getReviewedAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getOrganizationName() { return organizationName; }
    public String getType() { return type; }
    public String getWebsite() { return website; }
    public String getInstagram() { return instagram; }
    public String getMessage() { return message; }
    public String getStatus() { return status; }
    public String getReviewNote() { return reviewNote; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
}
