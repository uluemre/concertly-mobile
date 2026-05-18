package com.concertly.backend.dto.request;

import java.util.List;

public class CreatePostRequest {

    private Long eventId;
    private String content;
    private String postType = "TEXT"; // TEXT, IMAGE, POLL
    private String imageUrl;
    private List<String> pollOptions;

    public Long getEventId()            { return eventId; }
    public String getContent()          { return content; }
    public String getPostType()         { return postType; }
    public String getImageUrl()         { return imageUrl; }
    public List<String> getPollOptions(){ return pollOptions; }

    public void setEventId(Long eventId)             { this.eventId = eventId; }
    public void setContent(String content)           { this.content = content; }
    public void setPostType(String postType)         { this.postType = postType; }
    public void setImageUrl(String imageUrl)         { this.imageUrl = imageUrl; }
    public void setPollOptions(List<String> options) { this.pollOptions = options; }
}