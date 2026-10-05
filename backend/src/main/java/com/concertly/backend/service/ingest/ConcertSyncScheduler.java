package com.concertly.backend.service.ingest;

import com.concertly.backend.model.SourceSyncRun;
import com.concertly.backend.repository.SourceSyncRunRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Tum konser kaynaklarini zamanlanmis olarak calistirir.
 *
 * Yalitim kurali: her kaynak kendi try/catch blogunda calisir. Biletinial
 * cokerse Ticketmaster senkronu etkilenmez, tersi de gecerli. Bir kaynagin
 * hatasi kosuyu bitirmez; yalnizca o kaynagin sonucu HATA olarak raporlanir.
 *
 * Kaynaklar Spring tarafindan enjekte edilir; yeni bir ConcertSource bean'i
 * eklendiginde burasi degismeden listeye dahil olur.
 *
 * Her kosu source_sync_runs tablosuna yazilir (kaynak sagligi). Ayni anda tek
 * toplu senkron calisir: gece zamanlayicisi, admin ve dis tetikleyici cakisirsa
 * ikincisi beklemeden "zaten calisiyor" der.
 */
@Service
public class ConcertSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ConcertSyncScheduler.class);

    /** Kosuyu kim baslatti (gecmiste gorunur). */
    public static final String BY_SCHEDULE = "SCHEDULED";
    public static final String BY_ADMIN = "ADMIN";
    public static final String BY_TRIGGER = "TRIGGER";

    private final List<ConcertSource> sources;
    private final SourceSyncRunRepository runRepository;
    private final AtomicBoolean running = new AtomicBoolean(false);

    /** Testler icin: gecmis yazilmaz. */
    public ConcertSyncScheduler(List<ConcertSource> sources) {
        this(sources, null);
    }

    @Autowired
    public ConcertSyncScheduler(List<ConcertSource> sources, SourceSyncRunRepository runRepository) {
        this.sources = sources;
        this.runRepository = runRepository;
    }

    /**
     * Her gece 04:00. Saat bilerek Ticketmaster'in eski 06:00 kosusundan farkli
     * secildi; eski zamanlayici yapilandirmayla kapatildi (application.properties
     * icinde ticketmaster.sync.cron=-), boylece ayni kaynak iki kez calismaz.
     */
    @Scheduled(cron = "${app.sources.sync-cron:0 0 4 * * *}")
    public void scheduledSync() {
        log.info("Zamanlanmis konser senkronizasyonu basliyor ({} kaynak)", sources.size());
        syncAllAs(BY_SCHEDULE);
    }

    /** Tum acik kaynaklari sirayla calistirir ve sonuclari dondurur. */
    public List<SourceSyncResult> syncAll() {
        return syncAllAs(BY_ADMIN);
    }

    /**
     * Tum acik kaynaklar. Baska bir toplu senkron suruyorsa calismaz ve bos
     * liste doner (cift calisma ayni kayitlari iki kez yazmaya ugrasirdi).
     */
    public List<SourceSyncResult> syncAllAs(String triggeredBy) {
        if (!running.compareAndSet(false, true)) {
            log.warn("Senkronizasyon zaten calisiyor; {} istegi atlandi", triggeredBy);
            return List.of();
        }
        try {
            List<SourceSyncResult> results = new ArrayList<>();
            for (ConcertSource source : sources) {
                results.add(syncOne(source, triggeredBy));
            }
            log.info("Senkronizasyon bitti: {}", results.stream().map(SourceSyncResult::summary).toList());
            return results;
        } finally {
            running.set(false);
        }
    }

    /** Toplu senkron su an calisiyor mu. */
    public boolean isRunning() {
        return running.get();
    }

    /** Tek kaynagi calistirir; hata firlatmaz, sonuca donusturur. */
    public SourceSyncResult syncOne(ConcertSource source) {
        return syncOne(source, BY_ADMIN);
    }

    private SourceSyncResult syncOne(ConcertSource source, String triggeredBy) {
        if (!source.isEnabled()) {
            log.info("{} kaynagi kapali, atlandi", source.code());
            return SourceSyncResult.ok(source.code(), 0, 0, 0, 0, 0);
        }
        LocalDateTime startedAt = LocalDateTime.now();
        long started = System.currentTimeMillis();
        SourceSyncResult result;
        try {
            result = source.sync();
            log.info(result.summary());
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - started;
            // Bilerek yutuluyor: bir kaynagin hatasi digerlerini durdurmamali.
            log.error("{} senkronizasyonu basarisiz: {}", source.code(), e.toString());
            result = SourceSyncResult.failed(source.code(), e.getMessage(), duration);
        }
        record(result, startedAt, triggeredBy);
        return result;
    }

    /** Gecmise yazar. Yazamazsa (tablo yoksa) senkronu bozmaz. */
    private void record(SourceSyncResult result, LocalDateTime startedAt, String triggeredBy) {
        if (runRepository == null) return;
        try {
            SourceSyncRun run = new SourceSyncRun();
            run.setSource(result.source());
            run.setStartedAt(startedAt);
            run.setDurationMs(result.durationMs());
            run.setProcessed(result.processed());
            run.setCreated(result.created());
            run.setUpdated(result.updated());
            run.setSkipped(result.skipped());
            run.setFailed(result.failed());
            String error = result.error();
            run.setError(error != null && error.length() > 500 ? error.substring(0, 500) : error);
            run.setTriggeredBy(triggeredBy);
            runRepository.save(run);
        } catch (Exception e) {
            log.warn("{} kosu gecmisi yazilamadi: {}", result.source(), e.getMessage());
        }
    }

    /** Kod ile tek kaynak calistirma (admin ucu icin). */
    public SourceSyncResult syncByCode(String code) {
        return sources.stream()
                .filter(s -> s.code().equalsIgnoreCase(code))
                .findFirst()
                .map(this::syncOne)
                .orElseGet(() -> SourceSyncResult.failed(code, "Bilinmeyen kaynak", 0));
    }

    /** Tanimli kaynak kodlari. */
    public List<String> availableSources() {
        return sources.stream().map(ConcertSource::code).toList();
    }

    /** Acik (calisacak) kaynak kodlari. */
    public List<String> enabledSources() {
        return sources.stream().filter(ConcertSource::isEnabled).map(ConcertSource::code).toList();
    }
}
