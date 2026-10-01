-- B1: sahibi silinen ve devralacak aktif uyesi olmayan topluluk arsivlenir (silinmez).
-- NULL = arsivli degil (mevcut satirlar aynen kalir). Veri guncellemesi yok; yalnizca nullable sutun.
ALTER TABLE communities ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
