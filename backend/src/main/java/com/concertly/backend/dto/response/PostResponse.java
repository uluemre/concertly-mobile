package com.concertly.backend.dto.response;

import com.concertly.backend.model.Post;
import java.time.LocalDateTime;
import java.util.List;

public class PostResponse {

    private Long id;
    private String content;
    private LocalDateTime createdAt;

    private long likeCount;
    private long commentCount;

    private Long userId;
    private String username;
    private String userProfileImageUrl;

    private Long eventId;
    private String eventName;

    private String postType;
    private String imageUrl;
    private List<PollOptionDto> pollOptions;

    public static PostResponse from(Post post, long likeCount, long commentCount) {
        PostResponse dto = new PostResponse();

        dto.id = post.getId();
        dto.content = post.getContent();
        dto.createdAt = post.getCreatedAt();

        dto.likeCount = likeCount;
        dto.commentCount = commentCount;

        if (post.getUser() != null) {
            dto.userId = post.getUser().getId();
            dto.username = post.getUser().getUsername();
            dto.userProfileImageUrl = post.getUser().getProfileImageUrl();
        }

        if (post.getEvent() != null) {
            dto.eventId = post.getEvent().getId();
            dto.eventName = post.getEvent().getName();
        }

        dto.postType = post.getPostType() != null ? post.getPostType() : "TEXT";
        dto.imageUrl = post.getImageUrl();

        return dto;
    }

    public void setPollOptions(List<PollOptionDto> pollOptions) {
        this.pollOptions = pollOptions;
    }

    // getters
    public Long getId() { return id; }
    public String getContent() { return content; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public long getLikeCount() { return likeCount; }
    public long getCommentCount() { return commentCount; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getUserProfileImageUrl() { return userProfileImageUrl; }
    public Long getEventId() { return eventId; }
    public String getEventName() { return eventName; }
    public String getPostType() { return postType; }
    public String getImageUrl() { return imageUrl; }
    public List<PollOptionDto> getPollOptions() { return pollOptions; }
}