package com.concertly.backend.dto.response;

import com.concertly.backend.model.Message;
import java.time.LocalDateTime;

public class MessageResponse {
    private Long id;
    private Long senderId;
    private Long receiverId;
    private String content;
    private Boolean isRead;
    private LocalDateTime createdAt;

    public static MessageResponse from(Message m) {
        MessageResponse dto = new MessageResponse();
        dto.id         = m.getId();
        dto.senderId   = m.getSender().getId();
        dto.receiverId = m.getReceiver().getId();
        dto.content    = m.getContent();
        dto.isRead     = m.getIsRead();
        dto.createdAt  = m.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getSenderId() { return senderId; }
    public Long getReceiverId() { return receiverId; }
    public String getContent() { return content; }
    public Boolean getIsRead() { return isRead; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
