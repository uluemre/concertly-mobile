package com.concertly.backend.dto.response;

import com.concertly.backend.model.Notification;
import java.time.LocalDateTime;

public class NotificationResponse {
    private Long id;
    private String type;
    private String entityType;
    private Long entityId;
    private Long actorId;
    private String actorUsername;
    private String actorProfileImageUrl;
    private String message;
    private Boolean isRead;
    private LocalDateTime createdAt;

    public static NotificationResponse from(Notification n) {
        NotificationResponse dto = new NotificationResponse();
        dto.id                   = n.getId();
        dto.type                 = n.getType();
        dto.entityType           = n.getEntityType();
        dto.entityId             = n.getEntityId();
        dto.actorId              = n.getActor() != null ? n.getActor().getId() : null;
        dto.actorUsername        = n.getActor() != null ? n.getActor().getUsername() : null;
        dto.actorProfileImageUrl = n.getActor() != null ? n.getActor().getProfileImageUrl() : null;
        dto.message              = n.getMessage();
        dto.isRead               = n.getIsRead();
        dto.createdAt            = n.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public String getType() { return type; }
    public String getEntityType() { return entityType; }
    public Long getEntityId() { return entityId; }
    public Long getActorId() { return actorId; }
    public String getActorUsername() { return actorUsername; }
    public String getActorProfileImageUrl() { return actorProfileImageUrl; }
    public String getMessage() { return message; }
    public Boolean getIsRead() { return isRead; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}