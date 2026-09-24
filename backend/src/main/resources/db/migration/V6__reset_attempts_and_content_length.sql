-- 1) Şifre sıfırlama kodu için yanlış deneme sayacı (kod artık BCrypt özetiyle saklanıyor;
--    reset_token sütunu 255, 60 karakterlik özet için yeterli).
-- 2) Gönderi / yorum / topluluk gönderisi metinleri 255 karakterle sınırlıydı;
--    mobil 500/300 karaktere izin verdiği için uzun gönderiler kaydedilemiyordu.
--
-- VARCHAR genişletmek PostgreSQL'de yalnızca şema değişikliğidir: tablo yeniden
-- yazılmaz, mevcut veri silinmez ya da değişmez. Hibernate ddl-auto=update sütun
-- genişliğini DEĞİŞTİRMEDİĞİ için bu dosya canlıda elle çalıştırılmalı.

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_attempts INTEGER;

ALTER TABLE posts ALTER COLUMN content TYPE VARCHAR(1000);
ALTER TABLE comments ALTER COLUMN content TYPE VARCHAR(1000);
ALTER TABLE community_posts ALTER COLUMN content TYPE VARCHAR(1000);
