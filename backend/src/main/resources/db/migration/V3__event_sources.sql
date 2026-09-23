-- Tek konserin birden fazla bilet kaynagi tasiyabilmesi.
--
-- NEDEN: events.external_id UNIQUE oldugu icin bir satir yalnizca tek kaynak
-- kimligi tutabiliyordu. Kaynak kimligi bu tabloya tasindi. Ayrica ice
-- aktarici kimligi buradan bulacagi icin, birlestirilmis bir konser ertesi
-- geceki sync ile yeniden olusturulmaz.
--
-- Bu migration hicbir etkinligi SILMEZ, GIZLEMEZ ya da alanlarini degistirmez.
-- events.external_id / source / ticket_url alanlari birincil kaynagin aynasi
-- olarak kalir; mevcut Ticketmaster akisi ve okuyan her yer bozulmaz.

CREATE TABLE IF NOT EXISTS event_sources (
    id            BIGSERIAL PRIMARY KEY,
    event_id      BIGINT       NOT NULL REFERENCES events(id),
    source        VARCHAR(20)  NOT NULL,
    external_id   VARCHAR(255) NOT NULL,
    ticket_url    VARCHAR(1000),
    source_url    VARCHAR(1000),
    is_primary    BOOLEAN      NOT NULL DEFAULT FALSE,
    first_seen_at TIMESTAMP,
    last_seen_at  TIMESTAMP,
    CONSTRAINT uk_event_sources_source_external UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_event_sources_event ON event_sources (event_id);

-- Birlestirilen kayit silinmez; hangi kayda tasindigi burada tutulur.
ALTER TABLE events ADD COLUMN IF NOT EXISTS merged_into_event_id BIGINT;

-- Backfill: kaynak satiri olmayan her etkinlik icin mevcut alanlarindan bir satir.
-- Etkinlik sayisi degismez, yalnizca event_sources buyur.
INSERT INTO event_sources (event_id, source, external_id, ticket_url, source_url,
                           is_primary, first_seen_at, last_seen_at)
SELECT e.id,
       COALESCE(e.source, 'ADMIN'),
       e.external_id,
       e.ticket_url,
       e.source_url,
       TRUE,
       now(),
       now()
FROM events e
WHERE e.external_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM event_sources s WHERE s.event_id = e.id)
ON CONFLICT (source, external_id) DO NOTHING;
