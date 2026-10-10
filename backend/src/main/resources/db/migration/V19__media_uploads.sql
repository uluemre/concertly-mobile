-- Yuklenen gorsellerin kaydi: gunluk yukleme kotasi + yetim gorsel temizligi.
-- Yeni tablo; mevcut veriye dokunmaz. Tekrar calistirilabilir.
-- Uygulanmazsa gorsel yukleme HATA verir (MediaController bu tabloya yazar).

CREATE TABLE IF NOT EXISTS media_uploads (
    id          BIGSERIAL PRIMARY KEY,
    storage_key VARCHAR(100) NOT NULL UNIQUE,
    user_id     BIGINT,
    size_bytes  BIGINT NOT NULL,
    created_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_uploads_user_created ON media_uploads (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_media_uploads_created ON media_uploads (created_at);
