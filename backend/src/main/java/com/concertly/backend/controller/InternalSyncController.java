package com.concertly.backend.controller;

import com.concertly.backend.repository.SourceSyncRunRepository;
import com.concertly.backend.service.ingest.ConcertSyncScheduler;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Dışarıdan (GitHub Actions) gece senkronunu tetikleme ucu.
 *
 * Neden: Render ücretsiz planda sunucu uyuyabilir ya da 04:00'te yeniden başlıyor
 * olabilir; o gece zamanlayıcı çalışmaz. Yedek iş sabah bu ucu çağırır, son
 * saatlerde başarılı koşu yoksa senkronu başlatır.
 *
 * Kimlik: JWT değil, SYNC_TRIGGER_TOKEN ortam değişkeniyle paylaşılan gizli anahtar
 * (X-Sync-Token başlığı). Anahtar tanımlı değilse uç yokmuş gibi 404 döner.
 * Senkron arka planda çalışır; istek hemen 202 ile döner (uzun sürer, HTTP
 * zaman aşımına takılmasın).
 */
@RestController
@RequestMapping("/api/internal")
public class InternalSyncController {

    private static final Logger log = LoggerFactory.getLogger(InternalSyncController.class);

    private final ConcertSyncScheduler scheduler;
    private final SourceSyncRunRepository runRepository;
    private final String triggerToken;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "external-sync");
        t.setDaemon(true);
        return t;
    });

    public InternalSyncController(ConcertSyncScheduler scheduler,
            SourceSyncRunRepository runRepository,
            @Value("${app.sources.trigger-token:}") String triggerToken) {
        this.scheduler = scheduler;
        this.runRepository = runRepository;
        this.triggerToken = triggerToken == null ? "" : triggerToken.trim();
    }

    /**
     * @param ifMissedHours verilirse ve son bu kadar saatte başarılı bir koşu varsa
     *                      hiçbir şey yapılmaz (yedek tetikleyici gece koşusunu tekrarlamasın)
     */
    @PostMapping("/sync")
    public ResponseEntity<Map<String, String>> trigger(
            @RequestHeader(value = "X-Sync-Token", required = false) String token,
            @RequestParam(required = false) Integer ifMissedHours) {
        if (triggerToken.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (!matches(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("status", "BAD_TOKEN"));
        }
        if (ifMissedHours != null && ifMissedHours > 0
                && runRepository.existsByFailedFalseAndStartedAtAfter(LocalDateTime.now().minusHours(ifMissedHours))) {
            return ResponseEntity.ok(Map.of("status", "SKIPPED_RECENT"));
        }
        if (scheduler.isRunning()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("status", "ALREADY_RUNNING"));
        }
        executor.submit(() -> {
            try {
                scheduler.syncAllAs(ConcertSyncScheduler.BY_TRIGGER);
            } catch (Exception e) {
                log.error("Dis tetikleyici senkronu basarisiz: {}", e.toString());
            }
        });
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("status", "STARTED"));
    }

    /** Sabit zamanlı karşılaştırma (anahtar tahmini için zamanlama sızmasın). */
    private boolean matches(String token) {
        if (token == null) return false;
        return MessageDigest.isEqual(token.trim().getBytes(StandardCharsets.UTF_8),
                triggerToken.getBytes(StandardCharsets.UTF_8));
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
