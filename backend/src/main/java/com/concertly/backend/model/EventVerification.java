package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "event_verifications",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "event_id"})
)
public class EventVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    private LocalDateTime verifiedAt = LocalDateTime.now();

    /** Doğrulama anındaki cihaz konumu — denetim/itiraz için saklanır. */
    private Double latitude;
    private Double longitude;

    /** Cihazın bildirdiği GPS hassasiyeti (metre). */
    private Double accuracyMeters;

    /** Mekan ile kullanıcı arasındaki hesaplanan mesafe (metre). */
    private Double distanceMeters;

    /** Doğrulamanın nasıl yapıldığı. Şimdilik tek yöntem: GPS. */
    @Enumerated(EnumType.STRING)
    private VerificationMethod method = VerificationMethod.GPS;

    /**
     * Cihaz konumu sahte (mock location) olarak bildirdiyse true. Kaydı
     * reddetmek yerine işaretliyoruz ki sonradan denetlenebilsin.
     */
    private Boolean mockLocationSuspected = Boolean.FALSE;

    public Long getId() { return id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }

    public LocalDateTime getVerifiedAt() { return verifiedAt; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Double getAccuracyMeters() { return accuracyMeters; }
    public void setAccuracyMeters(Double accuracyMeters) { this.accuracyMeters = accuracyMeters; }

    public Double getDistanceMeters() { return distanceMeters; }
    public void setDistanceMeters(Double distanceMeters) { this.distanceMeters = distanceMeters; }

    public VerificationMethod getMethod() { return method; }
    public void setMethod(VerificationMethod method) { this.method = method; }

    public Boolean getMockLocationSuspected() { return mockLocationSuspected; }
    public void setMockLocationSuspected(Boolean v) { this.mockLocationSuspected = v; }
}
