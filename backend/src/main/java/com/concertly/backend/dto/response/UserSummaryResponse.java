package com.concertly.backend.dto.response;

import com.concertly.backend.model.User;

public class UserSummaryResponse {

    private Long id;
    private String username;
    private String profileImageUrl;
    private long followerCount;
    private long followingCount;
    private boolean isFollowedByCurrentUser;

    public static UserSummaryResponse from(User user,
                                           long followerCount,
                                           long followingCount,
                                           boolean isFollowedByCurrentUser) {
        UserSummaryResponse dto = new UserSummaryResponse();
        dto.id                      = user.getId();
        dto.username                = user.getUsername();
        dto.profileImageUrl         = user.getProfileImageUrl();
        dto.followerCount           = followerCount;
        dto.followingCount          = followingCount;
        dto.isFollowedByCurrentUser = isFollowedByCurrentUser;
        return dto;
    }

    public Long getId()                        { return id; }
    public String getUsername()                { return username; }
    public String getProfileImageUrl()         { return profileImageUrl; }
    public long getFollowerCount()             { return followerCount; }
    public long getFollowingCount()            { return followingCount; }
    public boolean isFollowedByCurrentUser()   { return isFollowedByCurrentUser; }
}