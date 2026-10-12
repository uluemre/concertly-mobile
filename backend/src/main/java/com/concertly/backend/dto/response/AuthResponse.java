package com.concertly.backend.dto.response;

public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private String tokenType = "Bearer";
    private Long userId;
    private String username;
    private String email;
    private String city;
    private String favoriteGenres;
    private Boolean onboardingCompleted;
    private Boolean isAdmin;
    private String fullName;
    // false → eski hesap: ad soyad / doğum tarihi eksik, uygulama bir kez sorar
    private Boolean profileComplete;

    public AuthResponse(String accessToken, String refreshToken, Long userId, String username, String email,
                        String city, String favoriteGenres, Boolean onboardingCompleted, Boolean isAdmin) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.city = city;
        this.favoriteGenres = favoriteGenres;
        this.onboardingCompleted = onboardingCompleted;
        this.isAdmin = isAdmin;
    }

    public String getAccessToken() { return accessToken; }
    public String getRefreshToken() { return refreshToken; }

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
    public Boolean getIsAdmin() { return isAdmin; }
    public String getFullName() { return fullName; }
    public Boolean getProfileComplete() { return profileComplete; }

    public AuthResponse withProfile(String fullName, boolean profileComplete) {
        this.fullName = fullName;
        this.profileComplete = profileComplete;
        return this;
    }
}