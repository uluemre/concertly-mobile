package com.concertly.backend.dto.request;

import java.util.List;

public class CreateCommunityPostRequest {

    private String content;
    private String postType = "TEXT"; // TEXT, IMAGE, POLL
    private String imageUrl;
    private List<String> pollOptions;

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getPostType() { return postType; }
    public void setPostType(String postType) { this.postType = postType; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public List<String> getPollOptions() { return pollOptions; }
    public void setPollOptions(List<String> pollOptions) { this.pollOptions = pollOptions; }
}
