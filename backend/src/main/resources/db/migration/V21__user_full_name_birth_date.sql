-- Kayitta ad soyad + dogum tarihi (18+). Eski hesaplarda bos kalir; uygulama giriste bir kez sorar.
-- Tekrar calistirilabilir (IF NOT EXISTS). Canlida elle calistirilir (yerelde ddl-auto=update sutunu ekler).
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(60) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE NULL;
