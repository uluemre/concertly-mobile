package com.concertly.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.Set;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String username;

    @Column(unique = true)
    private String email;

    @Column(unique = true)
    private String phone;

    private String password;

    private String bio;

    private String profileImageUrl;

    private String city;

    @Column(length = 500)
    private String favoriteGenres;

    private Boolean onboardingCompleted = false;

    private Boolean isVerified = false;

    private Boolean isActive = true;

    private String resetToken;
    private LocalDateTime resetTokenExpiry;

    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt = LocalDateTime.now();

    // 🔥 ROLE RELATION
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"), inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new java.util.HashSet<>();

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public void setProfileImageUrl(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getFavoriteGenres() {
        return favoriteGenres;
    }

    public void setFavoriteGenres(String favoriteGenres) {
        this.favoriteGenres = favoriteGenres;
    }

    public Boolean getOnboardingCompleted() {
        return onboardingCompleted;
    }

    public void setOnboardingCompleted(Boolean onboardingCompleted) {
        this.onboardingCompleted = onboardingCompleted;
    }

    public Boolean getIsVerified() {
        return isVerified;
    }

    public void setIsVerified(Boolean isVerified) {
        this.isVerified = isVerified;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    public void setRoles(Set<Role> roles) {
        this.roles = roles;
    }

    public String getResetToken() { return resetToken; }
    public void setResetToken(String resetToken) { this.resetToken = resetToken; }
    public LocalDateTime getResetTokenExpiry() { return resetTokenExpiry; }
    public void setResetTokenExpiry(LocalDateTime resetTokenExpiry) { this.resetTokenExpiry = resetTokenExpiry; }
}