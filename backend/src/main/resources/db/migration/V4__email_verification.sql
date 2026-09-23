-- Kayitta e-posta dogrulama kodu.
--
-- Mevcut hesaplar email_verified = NULL kalir ve dogrulanmis sayilir; bu
-- migration hicbir kullanicinin girisini engellemez. Yalnizca bundan sonra
-- acilan hesaplar FALSE baslar. Kodun kendisi degil BCrypt ozeti saklanir.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_code_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expiry TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_attempts INTEGER;
