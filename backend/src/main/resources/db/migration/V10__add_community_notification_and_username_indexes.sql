-- DB-C08: sik kullanilan sorgular icin performans indeksleri (veri degismez).
-- DB-N55: kullanici adinin buyuk/kucuk harf duyarsiz tekilligi.
-- Tablolar kucuk oldugu icin normal CREATE INDEX kullanilir (CONCURRENTLY yok; Flyway
-- migration'i transaction icinde calistirir). IF NOT EXISTS ile tekrar calistirilabilir.
-- users_username_key ve DB-C02 tekillik kisitlarina dokunulmaz.
-- ONKOSUL (uq_users_username_lower): users tablosunda lower(username) cakismasi olmamali;
-- varsa indeks olusturulamaz ve migration durur:
--   SELECT lower(username), count(*) FROM users GROUP BY lower(username) HAVING count(*) > 1;

-- DB-C08 1) Topluluk silinince ilgili bildirimlerin silinmesi (deleteByEntityTypeAndEntityId)
CREATE INDEX IF NOT EXISTS idx_notifications_entity
    ON notifications (entity_type, entity_id);

-- DB-C08 2) Begeni/takip tekrar bildirimi kontrolu ve takip istegi bildirimi temizligi
--           (existsByRecipientIdAndActorIdAndTypeAndEntityId, deleteByRecipientIdAndActorIdAndType);
--           recipient_id on eki bildirim listesi ve okunmamis sayisina da yardim eder
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_actor_type_entity
    ON notifications (recipient_id, actor_id, type, entity_id);

-- DB-C08 3) Topluluk gonderi listesi ve toplu sayimlar
CREATE INDEX IF NOT EXISTS idx_community_posts_community
    ON community_posts (community_id);

-- DB-C08 4) Uye/bekleyen/yasakli listeleri ve sayimlar (mevcut tekillik indeksi user_id ile basliyor)
CREATE INDEX IF NOT EXISTS idx_community_members_community_status
    ON community_members (community_id, status);

-- DB-C08 5) Gonderi yorumlari ve yorum sayilari
CREATE INDEX IF NOT EXISTS idx_community_post_comments_post
    ON community_post_comments (community_post_id);

-- DB-C08 6) Gonderi basina begeni sayisi (mevcut tekillik indeksi user_id ile basliyor)
CREATE INDEX IF NOT EXISTS idx_community_post_likes_post
    ON community_post_likes (community_post_id);

-- DB-N55 7) Kullanici adi buyuk/kucuk harf duyarsiz tekil
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower
    ON users (lower(username));
