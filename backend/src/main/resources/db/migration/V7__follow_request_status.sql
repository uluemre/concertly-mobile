-- SEC-05 "Ozel Hesap": takip istegi durumu.
-- NULL = ACCEPTED (mevcut satirlar aynen kabul edilmis takip sayilir); ozel hesaba istek PENDING yazilir.
-- Veri guncellemesi yok; yalnizca nullable sutun ve bekleyen istekleri listelemek icin indeks.
ALTER TABLE follows ADD COLUMN IF NOT EXISTS status VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_follows_following_status ON follows (following_id, status);
