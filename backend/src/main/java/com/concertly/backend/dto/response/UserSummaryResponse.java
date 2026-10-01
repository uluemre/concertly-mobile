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
    private String favoriteGenres;

    @JsonProperty("isFollowedByCurrentUser")
    private boolean isFollowedByCurrentUser;

    // SEC-05 özel hesap: hesap özel mi + izleyicinin takip durumu (NONE | PENDING | ACCEPTED)
    @JsonProperty("isPrivate")
    private boolean isPrivate;
    private String followStatus = "NONE";

    // E-posta/telefon varsayılan olarak DÖNÜLMEZ — bu DTO takipçi listeleri ve
    // herkese açık (permitAll) profil ucunda kullanılıyor; kişisel iletişim
    // bilgisi yalnızca kullanıcı KENDİ profilini çekerken eklenir (aşağıdaki overload).
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
        dto.favoriteGenres = user.getFavoriteGenres();
        dto.followerCount = followerCount;
        dto.followingCount = followingCount;
        dto.isFollowedByCurrentUser = isFollowedByCurrentUser;
        dto.isPrivate = Boolean.TRUE.equals(user.getPrivateAccount());
        return dto;
    }

    /** Takip durumu: isFollowedByCurrentUser yalnızca ACCEPTED için true olur. */
    public UserSummaryResponse withFollowStatus(String followStatus) {
        this.followStatus = followStatus == null ? "NONE" : followStatus;
        return this;
    }

    /** Özel hesap + yetkisiz izleyici: yalnızca başlık alanları kalır (şehir, türler gizlenir). */
    public UserSummaryResponse restrictToHeader() {
        this.city = null;
        this.favoriteGenres = null;
        return this;
    }

    public static UserSummaryResponse from(User user,
            long followerCount,
            long followingCount,
            boolean isFollowedByCurrentUser,
            boolean includeContactInfo) {
        UserSummaryResponse dto = from(user, followerCount, followingCount, isFollowedByCurrentUser);
        if (includeContactInfo) {
            dto.email = user.getEmail();
            dto.phone = user.getPhone();
        }
        return dto;
    }

    public String getBio() { return bio; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getFavoriteGenres() { return favoriteGenres; }
    public boolean getIsPrivate() { return isPrivate; }
    public String getFollowStatus() { return followStatus; }

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