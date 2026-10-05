package com.concertly.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Bir konser kaynağının tek senkronizasyon koşusu. Kaynak sağlığını izlemek için
 * tutulur: bir kaynak bir gecede sıfıra düşerse ya da hata verirse adminde görünür
 * (site tasarımı değişince okuyucu sessizce boş dönebilir).
 */
@Entity
@Table(name = "source_sync_runs",
        indexes = @Index(name = "idx_source_sync_runs_source_started", columnList = "source, started_at"))
public class SourceSyncRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Kaynak kodu, ör. BUBILET. */
    @Column(nullable = false, length = 40)
    private String source;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "duration_ms", nullable = false)
    private long durationMs;

    /** Kaynaktan okunan kayıt sayısı. */
    @Column(nullable = false)
    private int processed;

    /** Bazı kaynaklar yeni/güncel ayrımını vermiyor: NULL = bilinmiyor. */
    private Integer created;
    private Integer updated;

    @Column(nullable = false)
    private int skipped;

    @Column(nullable = false)
    private boolean failed;

    @Column(length = 500)
    private String error;

    /** SCHEDULED | ADMIN | TRIGGER — koşuyu kim başlattı. */
    @Column(name = "triggered_by", length = 20)
    private String triggeredBy;

    public Long getId() { return id; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public long getDurationMs() { return durationMs; }
    public void setDurationMs(long durationMs) { this.durationMs = durationMs; }
    public int getProcessed() { return processed; }
    public void setProcessed(int processed) { this.processed = processed; }
    public Integer getCreated() { return created; }
    public void setCreated(Integer created) { this.created = created; }
    public Integer getUpdated() { return updated; }
    public void setUpdated(Integer updated) { this.updated = updated; }
    public int getSkipped() { return skipped; }
    public void setSkipped(int skipped) { this.skipped = skipped; }
    public boolean isFailed() { return failed; }
    public void setFailed(boolean failed) { this.failed = failed; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    public String getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(String triggeredBy) { this.triggeredBy = triggeredBy; }
}
