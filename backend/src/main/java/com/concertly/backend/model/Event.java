package com.concertly.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "events", uniqueConstraints = @UniqueConstraint(columnNames = "external_id"))
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String genre;
    private String imageUrl;
    private String ticketUrl;

    public String getGenre() {
        return genre;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getTicketUrl() {
        return ticketUrl;
    }

    public void setTicketUrl(String ticketUrl) {
        this.ticketUrl = ticketUrl;
    }

    private String description;

    private LocalDateTime eventDate;

    private String externalId;

    private Boolean isApproved = false;

    /**
     * Mükerrer birleştirildiğinde asıl kaydın kimliği.
     *
     * Birleştirilen kayıt SİLİNMEZ: is_approved=false ile gizlenir ve burada
     * hangi kayda taşındığı tutulur. Böylece işlem geri alınabilir.
     */
    private Long mergedIntoEventId;

    /** Etkinliğin geldiği kanal — tek veri kaynağına bağımlılığı ölçmek için. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private EventSource source = EventSource.ADMIN;

    /** Kaynağın doğrulandığı rozet: Ticketmaster, organizatör hesabı ya da
     *  admin incelemesi. Kullanıcı önerisi onaylanana kadar false kalır. */
    private Boolean isVerified = false;

    /** Öneriyi destekleyen bağlantı (Instagram gönderisi, mekan sitesi, bilet linki). */
    @Column(length = 500)
    private String sourceUrl;

    @ManyToOne
    @JoinColumn(name = "artist_id")
    private Artist artist;

    @ManyToOne
    @JoinColumn(name = "venue_id")
    private Venue venue;

    @ManyToOne
    @JoinColumn(name = "created_by_user_id", nullable = true) // ✅ nullable
    private User createdBy;

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String desc) {
        this.description = desc;
    }

    public LocalDateTime getEventDate() {
        return eventDate;
    }

    public void setEventDate(LocalDateTime d) {
        this.eventDate = d;
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String id) {
        this.externalId = id;
    }

    public Boolean getIsApproved() {
        return isApproved;
    }

    public void setIsApproved(Boolean val) {
        this.isApproved = val;
    }

    public Artist getArtist() {
        return artist;
    }

    public void setArtist(Artist artist) {
        this.artist = artist;
    }

    public Venue getVenue() {
        return venue;
    }

    public void setVenue(Venue venue) {
        this.venue = venue;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User user) {
        this.createdBy = user;
    }

    public Long getMergedIntoEventId() { return mergedIntoEventId; }
    public void setMergedIntoEventId(Long mergedIntoEventId) { this.mergedIntoEventId = mergedIntoEventId; }

    public EventSource getSource() { return source == null ? EventSource.ADMIN : source; }
    public void setSource(EventSource source) { this.source = source; }

    public Boolean getIsVerified() { return isVerified != null && isVerified; }
    public void setIsVerified(Boolean isVerified) { this.isVerified = isVerified; }

    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
}
