package com.concertly.backend.dto.response;

import com.concertly.backend.model.Notification;
import java.time.LocalDateTime;

public class NotificationResponse {
    private Long id;
    private String type;
    private String entityType;
    private Long entityId;
    private String actorUsername;
    private Boolean isRead;
    private LocalDateTime createdAt;

    public static NotificationResponse from(Notification n) {
        NotificationResponse dto = new NotificationResponse();
        dto.id            = n.getId();
        dto.type          = n.getType();
        dto.entityType    = n.getEntityType();
        dto.entityId      = n.getEntityId();
        dto.actorUsername = n.getActor() != null ? n.getActor().getUsername() : null;
        dto.isRead        = n.getIsRead();
        dto.createdAt     = n.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public String getType() { return type; }
    public String getEntityType() { return entityType; }
    public Long getEntityId() { return entityId; }
    public String getActorUsername() { return actorUsername; }
    public Boolean getIsRead() { return isRead; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}