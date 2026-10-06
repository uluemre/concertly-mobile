-- Sanatci fotografinin kaynagi ve son kontrol zamani (gece fotograf gorevi).
-- Yeni nullable sutunlar; mevcut satirlar degismez. Tekrar calistirilabilir.
-- Uygulanmazsa sanatci sorgulari HATA verir (entity bu sutunlari bekler).

ALTER TABLE artists ADD COLUMN IF NOT EXISTS image_source VARCHAR(20);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS image_checked_at TIMESTAMP;
