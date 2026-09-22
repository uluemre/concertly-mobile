-- Biletinial kaynagi icin sema guncellemeleri.
--
-- NEDEN GEREKLI
-- 1) events.source sutununda Hibernate tarafindan uretilmis bir CHECK kisitlamasi
--    var ve yalnizca ilk dort enum degerini listeliyor. ddl-auto=update mevcut
--    kisitlamalari GUNCELLEMEZ, bu yuzden BILETINIAL kaydi eklemek
--    "events_source_check" ihlaliyle reddedilir.
-- 2) Flyway oncesi doneme ait Ticketmaster kayitlarinin source alani bos; kaynak
--    bazli raporlama ve eslestirme icin etiketlenmeleri gerekiyor.
-- 3) /api/concerts sorgusu is_approved + event_date uzerinden calisiyor.

-- ── 1. Kaynak listesini guncelle ────────────────────────────────────────────
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_source_check;
ALTER TABLE events ADD CONSTRAINT events_source_check
    CHECK (source IS NULL OR source::text IN
           ('TICKETMASTER', 'BILETINIAL', 'ADMIN', 'USER', 'ORGANIZER'));

-- ── 2. Eski Ticketmaster kayitlarini etiketle ───────────────────────────────
-- DIKKAT: "source IS NULL" olan her kayit Ticketmaster DEGILDIR; seed katalogu
-- (catalog_*), demo verisi (test-*) ve kimliksiz kayitlar da bu kumede.
-- Bu yuzden IKI BAGIMSIZ SINYAL birden aranir:
--   a) externalId Ticketmaster kimlik desenine uyar,
--   b) bilet linki biletix.com'dur (Ticketmaster Turkiye markasi).
--
-- Uygulamadan once etkilenecek satirlari GORMEK icin:
--   SELECT count(*) FROM events WHERE source IS NULL
--     AND external_id ~ '^[A-Za-z0-9_-]{15,20}$'
--     AND ticket_url LIKE '%biletix.com%';
--
-- Bu ifade yalnizca BOS source alanini doldurur; hicbir satiri silmez ve
-- dolu bir source degerini degistirmez.
UPDATE events
SET source = 'TICKETMASTER'
WHERE source IS NULL
  AND external_id ~ '^[A-Za-z0-9_-]{15,20}$'
  AND ticket_url LIKE '%biletix.com%';

-- ── 3. Konser listesi sorgusu icin indeks ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_approved_event_date
    ON events (is_approved, event_date);
