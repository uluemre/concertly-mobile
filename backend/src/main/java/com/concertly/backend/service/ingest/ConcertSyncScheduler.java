package com.concertly.backend.service.ingest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Tum konser kaynaklarini zamanlanmis olarak calistirir.
 *
 * Yalitim kurali: her kaynak kendi try/catch blogunda calisir. Biletinial
 * cokerse Ticketmaster senkronu etkilenmez, tersi de gecerli. Bir kaynagin
 * hatasi kosuyu bitirmez; yalnizca o kaynagin sonucu HATA olarak raporlanir.
 *
 * Kaynaklar Spring tarafindan enjekte edilir; yeni bir ConcertSource bean'i
 * eklendiginde burasi degismeden listeye dahil olur.
 */
@Service
public class ConcertSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ConcertSyncScheduler.class);

    private final List<ConcertSource> sources;

    public ConcertSyncScheduler(List<ConcertSource> sources) {
        this.sources = sources;
    }

    /**
     * Her gece 04:00. Saat bilerek Ticketmaster'in eski 06:00 kosusundan farkli
     * secildi; eski zamanlayici yapilandirmayla kapatildi (application.properties
     * icinde ticketmaster.sync.cron=-), boylece ayni kaynak iki kez calismaz.
     */
    @Scheduled(cron = "${app.sources.sync-cron:0 0 4 * * *}")
    public void scheduledSync() {
        log.info("Zamanlanmis konser senkronizasyonu basliyor ({} kaynak)", sources.size());
        syncAll();
    }

    /** Tum acik kaynaklari sirayla calistirir ve sonuclari dondurur. */
    public List<SourceSyncResult> syncAll() {
        List<SourceSyncResult> results = new ArrayList<>();
        for (ConcertSource source : sources) {
            results.add(syncOne(source));
        }
        log.info("Senkronizasyon bitti: {}", results.stream().map(SourceSyncResult::summary).toList());
        return results;
    }

    /** Tek kaynagi calistirir; hata firlatmaz, sonuca donusturur. */
    public SourceSyncResult syncOne(ConcertSource source) {
        if (!source.isEnabled()) {
            log.info("{} kaynagi kapali, atlandi", source.code());
            return SourceSyncResult.ok(source.code(), 0, 0, 0, 0, 0);
        }
        long started = System.currentTimeMillis();
        try {
            SourceSyncResult result = source.sync();
            log.info(result.summary());
            return result;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - started;
            // Bilerek yutuluyor: bir kaynagin hatasi digerlerini durdurmamali.
            log.error("{} senkronizasyonu basarisiz: {}", source.code(), e.toString());
            return SourceSyncResult.failed(source.code(), e.getMessage(), duration);
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
}
