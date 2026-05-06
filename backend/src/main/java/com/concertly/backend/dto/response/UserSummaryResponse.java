package com.concertly.backend.dto.response;

import com.concertly.backend.model.User;
import com.fasterxml.jackson.annotation.JsonProperty;

public class UserSummaryResponse {

    private Long id;
    private String username;
    private String profileImageUrl;
    private long followerCount;
    private long followingCount;
    private String city;
    private String bio;
    private String email;
    private String phone;

    // ✅ Mobil 'isFollowedByCurrentUser' bekliyor, Jackson bunu
    // 'followedByCurrentUser' yapıyor
    @JsonProperty("isFollowedByCurrentUser")
    private boolean isFollowedByCurrentUser;

    public static UserSummaryResponse from(User user,
            long followerCount,
            long followingCount,
            boolean isFollowedByCurrentUser) {
        UserSummaryResponse dto = new UserSummaryResponse();
        dto.id = user.getId();
        dto.username = user.getUsername();
        dto.profileImageUrl = user.getProfileImageUrl();
        dto.city = user.getCity();
        dto.bio = user.getBio();
        dto.email = user.getEmail();
        dto.phone = user.getPhone();
        dto.followerCount = followerCount;
        dto.followingCount = followingCount;
        dto.isFollowedByCurrentUser = isFollowedByCurrentUser;
        return dto;
    }

    public String getBio() { return bio; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public long getFollowerCount() {
        return followerCount;
    }

    public long getFollowingCount() {
        return followingCount;
    }

    public String getCity() {
        return city;
    }

    public boolean isFollowedByCurrentUser() {
        return isFollowedByCurrentUser;
    }
}