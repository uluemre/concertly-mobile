package com.concertly.backend.dto.request;

public class CreatePostRequest {

    private Long eventId;
    private String content;

    public Long getEventId()       { return eventId; }
    public String getContent()     { return content; }

    public void setEventId(Long eventId)     { this.eventId = eventId; }
    public void setContent(String content)   { this.content = content; }
}