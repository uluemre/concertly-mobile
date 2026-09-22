package com.concertly.backend.service.ingest;

/**
 * Bir kaynagin tek senkronizasyon kosusunun sonucu.
 *
 * created/updated NULL olabilir: her kaynak bu ayrimi vermiyor (Ticketmaster
 * kendi upsert mantigini calistirip yalnizca toplam sayiyi donduruyor).
 * Rakami uydurmak yerine bilinmedigini durust sekilde tasiyoruz.
 */
public record SourceSyncResult(
        String source,
        int processed,
        Integer created,
        Integer updated,
        int skipped,
        boolean failed,
        String error,
        long durationMs) {

    public static SourceSyncResult ok(String source, int processed, Integer created,
            Integer updated, int skipped, long durationMs) {
        return new SourceSyncResult(source, processed, created, updated, skipped, false, null, durationMs);
    }

    public static SourceSyncResult failed(String source, String error, long durationMs) {
        return new SourceSyncResult(source, 0, null, null, 0, true, error, durationMs);
    }

    public String summary() {
        if (failed) return source + ": HATA - " + error + " (" + durationMs + " ms)";
        String detail = created != null ? (created + " yeni, " + updated + " guncel") : (processed + " islendi");
        return source + ": " + detail + ", " + skipped + " atlandi (" + durationMs + " ms)";
    }
}
