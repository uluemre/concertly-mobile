package com.concertly.backend.dto.request;

public class UpdateProfileRequest {

    private String bio;
    private String profileImageUrl;

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getProfileImageUrl() { return profileImageUrl; }
    public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }
}