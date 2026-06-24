package com.concertly.backend.dto.response;

import com.concertly.backend.model.CommunityPost;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

public class CommunityPostResponse {

    private Long id;
    private String content;
    private LocalDateTime createdAt;
    private long likeCount;
    private long commentCount;

    private String postType;
    private String imageUrl;
    private List<PollOptionDto> pollOptions;

    private Long userId;
    private String username;
    private String userProfileImageUrl;

    private Long communityId;
    private String communityName;

    @JsonProperty("isLikedByCurrentUser")
    private boolean isLikedByCurrentUser;

    public static CommunityPostResponse from(CommunityPost post,
                                              long likeCount,
                                              boolean isLikedByCurrentUser) {
        return from(post, likeCount, 0, isLikedByCurrentUser);
    }

    public static CommunityPostResponse from(CommunityPost post,
                                              long likeCount,
                                              long commentCount,
                                              boolean isLikedByCurrentUser) {
        CommunityPostResponse dto = new CommunityPostResponse();
        dto.id = post.getId();
        dto.content = post.getContent();
        dto.createdAt = post.getCreatedAt();
        dto.likeCount = likeCount;
        dto.commentCount = commentCount;
        dto.isLikedByCurrentUser = isLikedByCurrentUser;
        dto.postType = post.getPostType();
        dto.imageUrl = post.getImageUrl();

        if (post.getUser() != null) {
            dto.userId = post.getUser().getId();
            dto.username = post.getUser().getUsername();
            dto.userProfileImageUrl = post.getUser().getProfileImageUrl();
        }

        if (post.getCommunity() != null) {
            dto.communityId = post.getCommunity().getId();
            dto.communityName = post.getCommunity().getName();
        }

        return dto;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public long getLikeCount() { return likeCount; }
    public long getCommentCount() { return commentCount; }
    public String getPostType() { return postType; }
    public String getImageUrl() { return imageUrl; }
    public List<PollOptionDto> getPollOptions() { return pollOptions; }
    public void setPollOptions(List<PollOptionDto> pollOptions) { this.pollOptions = pollOptions; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getUserProfileImageUrl() { return userProfileImageUrl; }
    public Long getCommunityId() { return communityId; }
    public String getCommunityName() { return communityName; }
    public boolean isLikedByCurrentUser() { return isLikedByCurrentUser; }
}
