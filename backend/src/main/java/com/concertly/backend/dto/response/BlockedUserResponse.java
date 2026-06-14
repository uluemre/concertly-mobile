package com.concertly.backend.dto.response;

import com.concertly.backend.model.User;

public class BlockedUserResponse {

    private Long id;
    private String username;
    private String profileImageUrl;
    private String city;

    public static BlockedUserResponse from(User user) {
        BlockedUserResponse dto = new BlockedUserResponse();
        dto.id = user.getId();
        dto.username = user.getUsername();
        dto.profileImageUrl = user.getProfileImageUrl();
        dto.city = user.getCity();
        return dto;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getProfileImageUrl() { return profileImageUrl; }
    public String getCity() { return city; }
}
