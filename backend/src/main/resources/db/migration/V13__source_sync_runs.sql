-- Konser kaynaklarinin senkronizasyon gecmisi (kaynak sagligi izleme).
--
-- Yeni tablo; mevcut hicbir satira dokunulmaz. Tekrar calistirilabilir.
-- Uygulanmazsa senkronizasyon yine calisir, yalnizca gecmis yazilamaz (hata yutulur).

CREATE TABLE IF NOT EXISTS source_sync_runs (
    id            BIGSERIAL PRIMARY KEY,
    source        VARCHAR(40)  NOT NULL,
    started_at    TIMESTAMP    NOT NULL,
    duration_ms   BIGINT       NOT NULL,
    processed     INTEGER      NOT NULL,
    created       INTEGER,
    updated       INTEGER,
    skipped       INTEGER      NOT NULL,
    failed        BOOLEAN      NOT NULL,
    error         VARCHAR(500),
    triggered_by  VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_source_sync_runs_source_started
    ON source_sync_runs (source, started_at);
