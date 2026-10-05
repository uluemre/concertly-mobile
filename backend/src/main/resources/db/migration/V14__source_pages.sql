-- Bilet sitelerinde kesfedilen etkinlik sayfalari ve siniflandirmasi (MUSIC / OTHER).
--
-- Site haritasindaki her sayfa bir kez acilip burada isaretlenir; sonraki gecelerde
-- yalnizca yeni sayfalar ve bilinen konserler acilir. Yeni tablo; mevcut satirlara
-- dokunulmaz. Tekrar calistirilabilir.
-- Uygulanmazsa Bubilet yalnizca konser liste sayfasini okur (eski davranis).

CREATE TABLE IF NOT EXISTS source_pages (
    id               BIGSERIAL PRIMARY KEY,
    source           VARCHAR(40)  NOT NULL,
    url              VARCHAR(500) NOT NULL,
    kind             VARCHAR(10)  NOT NULL,
    first_seen_at    TIMESTAMP    NOT NULL,
    last_checked_at  TIMESTAMP    NOT NULL,
    CONSTRAINT uk_source_pages_source_url UNIQUE (source, url)
);
