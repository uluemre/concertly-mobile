package com.concertly.backend.dto.response;

public class UserResponse {

    private Long id;
    private String username;
    private String email;
    private String city;
    private String favoriteGenres;
    private Boolean onboardingCompleted;
    private Boolean isActive;
    private Boolean isAdmin;
    private Integer postCount;

    public UserResponse(Long id, String username, String email) {
        this(id, username, email, null);
    }

    public UserResponse(Long id, String username, String email, String city) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.city = city;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getCity() { return city; }
    public String getFavoriteGenres() { return favoriteGenres; }
    public void setFavoriteGenres(String favoriteGenres) { this.favoriteGenres = favoriteGenres; }
    public Boolean getOnboardingCompleted() { return onboardingCompleted; }
    public void setOnboardingCompleted(Boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public Boolean getIsAdmin() { return isAdmin; }
    public void setIsAdmin(Boolean isAdmin) { this.isAdmin = isAdmin; }
    public Integer getPostCount() { return postCount; }
    public void setPostCount(Integer postCount) { this.postCount = postCount; }
}