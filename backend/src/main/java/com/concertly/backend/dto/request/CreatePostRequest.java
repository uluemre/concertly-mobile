package com.concertly.backend.dto.request;

public class CreatePostRequest {

    private Long userId;
    private Long eventId;
    private String content;

    public Long getUserId()        { return userId; }
    public Long getEventId()       { return eventId; }
    public String getContent()     { return content; }

    public void setUserId(Long userId)       { this.userId = userId; }
    public void setEventId(Long eventId)     { this.eventId = eventId; }
    public void setContent(String content)   { this.content = content; }
}