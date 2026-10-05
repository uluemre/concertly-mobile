package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Bir bilet sitesinde keşfedilen etkinlik sayfası ve sınıflandırması.
 *
 * Site haritasında binlerce etkinlik (konser + tiyatro + stand-up …) var; hangisinin
 * konser olduğu ancak sayfa açılınca anlaşılıyor. Her sayfa BİR KEZ açılıp burada
 * işaretlenir; sonraki gecelerde yalnızca yeni sayfalar ve bilinen konserler açılır.
 * Böylece karşı siteye her gece binlerce istek atılmaz.
 */
@Entity
@Table(name = "source_pages",
        uniqueConstraints = @UniqueConstraint(name = "uk_source_pages_source_url", columnNames = {"source", "url"}))
public class SourcePage {

    public static final String MUSIC = "MUSIC";
    public static final String OTHER = "OTHER";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String source;

    @Column(nullable = false, length = 500)
    private String url;

    /** MUSIC | OTHER */
    @Column(nullable = false, length = 10)
    private String kind;

    @Column(name = "first_seen_at", nullable = false)
    private LocalDateTime firstSeenAt = LocalDateTime.now();

    @Column(name = "last_checked_at", nullable = false)
    private LocalDateTime lastCheckedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public LocalDateTime getFirstSeenAt() { return firstSeenAt; }
    public LocalDateTime getLastCheckedAt() { return lastCheckedAt; }
    public void setLastCheckedAt(LocalDateTime lastCheckedAt) { this.lastCheckedAt = lastCheckedAt; }

    public boolean isMusic() { return MUSIC.equals(kind); }
}
