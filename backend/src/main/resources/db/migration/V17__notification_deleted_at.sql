-- Kullanicinin sildigi bildirimler: satir silinmez, deleted_at ile listeden duser.
-- ("Ayni bildirimi tekrar gonderme" kontrolleri satirlara baktigi icin gercek silme
-- hatirlatmalarin yeniden gelmesine yol acardi.) Yeni nullable sutun; mevcut satirlar
-- degismez. Tekrar calistirilabilir. Uygulanmazsa bildirim listesi HATA verir.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
