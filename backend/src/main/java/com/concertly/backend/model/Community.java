package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "communities")
public class Community {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String type;
    private String city;
    private String emoji;
    private String gradientStart;
    private String gradientEnd;
    private String description;
    private String nextEvent;
    private String tags;

    private Boolean live = false;

    // PUBLIC = herkes anında katılır · PRIVATE = istek/onay veya davet · SECRET = sadece davet, listede görünmez
    private String visibility = "PUBLIC";

    // PENDING = kuruldu, admin incelemesi bekliyor (yine de kullanılabilir) · APPROVED · REJECTED
    private String approvalStatus = "PENDING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    // Davet linki kodu (PRIVATE/SECRET topluluklara katılım için). null = link yok.
    @Column(unique = true)
    private String inviteCode;

    private LocalDateTime reviewedAt;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public String getGradientStart() { return gradientStart; }
    public void setGradientStart(String gradientStart) { this.gradientStart = gradientStart; }

    public String getGradientEnd() { return gradientEnd; }
    public void setGradientEnd(String gradientEnd) { this.gradientEnd = gradientEnd; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getNextEvent() { return nextEvent; }
    public void setNextEvent(String nextEvent) { this.nextEvent = nextEvent; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public Boolean getLive() { return live; }
    public void setLive(Boolean live) { this.live = live; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

    public String getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(String approvalStatus) { this.approvalStatus = approvalStatus; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
