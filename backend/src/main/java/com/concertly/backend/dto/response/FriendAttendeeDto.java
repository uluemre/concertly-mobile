package com.concertly.backend.dto.response;

import com.concertly.backend.model.User;

public class FriendAttendeeDto {
    private Long userId;
    private String username;
    private String profileImageUrl;

    public static FriendAttendeeDto from(User user) {
        FriendAttendeeDto dto = new FriendAttendeeDto();
        dto.userId = user.getId();
        dto.username = user.getUsername();
        dto.profileImageUrl = user.getProfileImageUrl();
        return dto;
    }

    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getProfileImageUrl() { return profileImageUrl; }
}
