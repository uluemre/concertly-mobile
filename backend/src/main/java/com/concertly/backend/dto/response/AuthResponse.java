package com.concertly.backend.dto.response;

public class AuthResponse {

    private String accessToken;
    private String tokenType = "Bearer";
    private Long userId;
    private String username;
    private String email;
    private String city;
    private String favoriteGenres;
    private Boolean onboardingCompleted;

    public AuthResponse(String accessToken, Long userId, String username, String email,
                        String city, String favoriteGenres, Boolean onboardingCompleted) {
        this.accessToken = accessToken;
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.city = city;
        this.favoriteGenres = favoriteGenres;
        this.onboardingCompleted = onboardingCompleted;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public String getTokenType() {
        return tokenType;
    }

    public Long getUserId() {
        return userId;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getCity() { return city; }
    public String getFavoriteGenres() { return favoriteGenres; }
    public Boolean getOnboardingCompleted() { return onboardingCompleted; }
}