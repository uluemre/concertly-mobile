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

    private String resetToken;              // şifre sıfırlama kodunun BCrypt özeti (düz kod saklanmaz)
    private LocalDateTime resetTokenExpiry;
    private Integer resetTokenAttempts;     // yanlış deneme sayısı; sınırda kod geçersizleşir

    // ── E-posta doğrulama ────────────────────────────────────────────────────
    // null = bu özellikten önce açılmış hesap → doğrulanmış sayılır.
    // Yeni kayıtlar false başlar, kod girilince true olur.
    private Boolean emailVerified;
    private String emailVerificationCodeHash;   // BCrypt; düz kod DB'de tutulmaz
    private LocalDateTime emailVerificationExpiry;
    private LocalDateTime emailVerificationSentAt;
    private Integer emailVerificationAttempts;

    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt = LocalDateTime.now();

    // ── Bildirim tercihleri (push) ────────────────────────────────────────────
    // Varsayılan açık: kullanıcı kaydolduğunda bildirim alır, Ayarlar'dan kapatır.
    private Boolean pushEnabled = true;
    private Boolean pushSocial = true;       // beğeni, yorum, takip
    private Boolean pushMessages = true;     // direkt mesaj
    private Boolean pushEvents = true;       // konser hatırlatması, yeni etkinlik
    private Boolean pushCommunities = true;  // topluluk davet/onay/yorum
    private Boolean pushGames = true;        // günün şarkısı

    // ── Gizlilik / güvenlik ───────────────────────────────────────────────────
    /** Bana kim mesaj atabilir. Varsayılan herkes; taciz durumunda daraltılır. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MessagePrivacy messagePrivacy = MessagePrivacy.EVERYONE;

    /** Profilimi/paylaşımlarımı yalnızca takipçilerim görsün. */
    private Boolean privateAccount = false;

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
    public Integer getResetTokenAttempts() { return resetTokenAttempts; }
    public void setResetTokenAttempts(Integer resetTokenAttempts) { this.resetTokenAttempts = resetTokenAttempts; }

    public Boolean getEmailVerified() { return emailVerified; }
    public void setEmailVerified(Boolean emailVerified) { this.emailVerified = emailVerified; }
    /** Eski hesaplar (null) doğrulanmış sayılır; yalnızca açıkça false olan bekler. */
    public boolean isEmailVerificationPending() { return Boolean.FALSE.equals(emailVerified); }
    public String getEmailVerificationCodeHash() { return emailVerificationCodeHash; }
    public void setEmailVerificationCodeHash(String h) { this.emailVerificationCodeHash = h; }
    public LocalDateTime getEmailVerificationExpiry() { return emailVerificationExpiry; }
    public void setEmailVerificationExpiry(LocalDateTime t) { this.emailVerificationExpiry = t; }
    public LocalDateTime getEmailVerificationSentAt() { return emailVerificationSentAt; }
    public void setEmailVerificationSentAt(LocalDateTime t) { this.emailVerificationSentAt = t; }
    public Integer getEmailVerificationAttempts() { return emailVerificationAttempts; }
    public void setEmailVerificationAttempts(Integer n) { this.emailVerificationAttempts = n; }

    // ── Bildirim tercihleri ───────────────────────────────────────────────────
    public Boolean getPushEnabled() { return pushEnabled; }
    public void setPushEnabled(Boolean pushEnabled) { this.pushEnabled = pushEnabled; }

    public Boolean getPushSocial() { return pushSocial; }
    public void setPushSocial(Boolean pushSocial) { this.pushSocial = pushSocial; }

    public Boolean getPushMessages() { return pushMessages; }
    public void setPushMessages(Boolean pushMessages) { this.pushMessages = pushMessages; }

    public Boolean getPushEvents() { return pushEvents; }
    public void setPushEvents(Boolean pushEvents) { this.pushEvents = pushEvents; }

    public Boolean getPushCommunities() { return pushCommunities; }
    public void setPushCommunities(Boolean pushCommunities) { this.pushCommunities = pushCommunities; }

    public Boolean getPushGames() { return pushGames; }
    public void setPushGames(Boolean pushGames) { this.pushGames = pushGames; }

    // ── Gizlilik ──────────────────────────────────────────────────────────────
    public MessagePrivacy getMessagePrivacy() {
        return messagePrivacy == null ? MessagePrivacy.EVERYONE : messagePrivacy;
    }
    public void setMessagePrivacy(MessagePrivacy messagePrivacy) { this.messagePrivacy = messagePrivacy; }

    public Boolean getPrivateAccount() { return privateAccount; }
    public void setPrivateAccount(Boolean privateAccount) { this.privateAccount = privateAccount; }
}
