package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Bir etkinligin tek bir bilet kaynagindaki karsiligi.
 *
 * Ayni gercek konser hem Ticketmaster hem Biletinial'de olabiliyor. events
 * tablosunda external_id UNIQUE oldugu icin bir satir yalnizca tek kaynak
 * kimligi tasiyabiliyordu; kaynak kimligi buraya tasindi ve bir Event artik
 * birden fazla kaynak satirina sahip olabiliyor.
 *
 * Bu ayni zamanda birlestirmenin KALICI olmasini saglar: ice aktarici kaydini
 * (source, externalId) ile burada aradigi icin, birlestirilmis bir konser
 * ertesi gece yeniden olusturulmaz.
 *
 * Not: Event uzerindeki external_id / source / ticket_url alanlari birincil
 * kaynagin aynasi olarak KALIYOR; mevcut Ticketmaster akisi ve okuyan her yer
 * bozulmadan calissin diye.
 */
@Entity
@Table(name = "event_sources",
        uniqueConstraints = @UniqueConstraint(name = "uk_event_sources_source_external",
                columnNames = {"source", "external_id"}),
        indexes = @Index(name = "idx_event_sources_event", columnList = "event_id"))
public class EventSourceLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EventSource source;

    @Column(name = "external_id", nullable = false, length = 255)
    private String externalId;

    @Column(name = "ticket_url", length = 1000)
    private String ticketUrl;

    @Column(name = "source_url", length = 1000)
    private String sourceUrl;

    /** Event uzerindeki ayna alanlarin hangi kaynaktan geldigini isaretler. */
    @Column(name = "is_primary", nullable = false)
    private Boolean isPrimary = false;

    @Column(name = "first_seen_at")
    private LocalDateTime firstSeenAt = LocalDateTime.now();

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt = LocalDateTime.now();

    public Long getId() { return id; }

    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }

    public EventSource getSource() { return source; }
    public void setSource(EventSource source) { this.source = source; }

    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }

    public String getTicketUrl() { return ticketUrl; }
    public void setTicketUrl(String ticketUrl) { this.ticketUrl = ticketUrl; }

    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }

    public Boolean getIsPrimary() { return isPrimary != null && isPrimary; }
    public void setIsPrimary(Boolean isPrimary) { this.isPrimary = isPrimary; }

    public LocalDateTime getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(LocalDateTime firstSeenAt) { this.firstSeenAt = firstSeenAt; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
