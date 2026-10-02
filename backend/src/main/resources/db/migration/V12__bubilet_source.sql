-- Bubilet kaynagi: kaynak listesini iceren CHECK kisitlamalarini genislet.
--
-- events.source ve event_sources.source sutunlarindaki kisitlamalar Hibernate
-- tarafindan uretildi; ddl-auto=update yeni enum degerini EKLEMEZ (bkz. V2).
-- Bu dosya uygulanmadan BUBILET kaydi yazilamaz (kayit atlanir, sync cokmez).
-- Yalnizca kisitlama degisir; hicbir satir guncellenmez. Tekrar calistirilabilir.

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_source_check;
ALTER TABLE events ADD CONSTRAINT events_source_check
    CHECK (source IS NULL OR source::text IN
           ('TICKETMASTER', 'BILETINIAL', 'BUBILET', 'ADMIN', 'USER', 'ORGANIZER'));

ALTER TABLE event_sources DROP CONSTRAINT IF EXISTS event_sources_source_check;
ALTER TABLE event_sources ADD CONSTRAINT event_sources_source_check
    CHECK (source::text IN
           ('TICKETMASTER', 'BILETINIAL', 'BUBILET', 'ADMIN', 'USER', 'ORGANIZER'));
