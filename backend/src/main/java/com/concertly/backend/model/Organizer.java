package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Doğrulanmış organizatör hesabı (organizatör, mekân ya da sanatçı menajeri).
 * Başvuru onaylanınca açılır; bir kullanıcının tek organizatör hesabı olur.
 * Etkinlikler events.organizer_id ile bağlanır.
 */
@Entity
@Table(name = "organizers")
public class Organizer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false, unique = true)
    private User owner;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 20)
    private String type = OrganizerRequest.Type.ORGANIZER.name();

    @Column(length = 1000)
    private String bio;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(length = 500)
    private String website;

    @Column(length = 500)
    private String instagram;

    @Column(nullable = false)
    private boolean verified = true;

    /** Katılımcılara duyuru gönderebilir mi (admin geri alabilir). */
    @Column(name = "can_announce", nullable = false)
    private boolean canAnnounce = true;

    /** Admin askıya alırsa false: panel kapanır, etkinlikler onaysız yayına giremez. */
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }
    public String getInstagram() { return instagram; }
    public void setInstagram(String instagram) { this.instagram = instagram; }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
    public boolean isCanAnnounce() { return canAnnounce; }
    public void setCanAnnounce(boolean canAnnounce) { this.canAnnounce = canAnnounce; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
