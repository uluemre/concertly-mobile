-- Gonderi ve Konser Arkadasi butunlugu: anket oyu tekilligi, akis indeksleri, kalici unmatch.
-- Tekrar calistirilabilir (IF NOT EXISTS). Canlida elle calistirilir (yerelde ddl-auto=update sutunu ekler).

-- 1) Ayni kullanicinin ayni ankete birden fazla oyu varsa en yenisi kalir, digerleri silinir.
--    (Unique indeksten ONCE calismali; aksi halde indeks olusturulamaz.)
DELETE FROM poll_votes a
USING poll_votes b
WHERE a.user_id = b.user_id
  AND a.post_id = b.post_id
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_poll_votes_user_post ON poll_votes (user_id, post_id);

-- 2) Akis / sayac indeksleri
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poll_votes_post ON poll_votes (post_id);
CREATE INDEX IF NOT EXISTS idx_buddy_swipes_target_liked ON buddy_swipes (target_id) WHERE liked;

-- 3) Kalici "eslesme kaldirildi" isareti (sohbeti iki yonde kapatir, undo ile silinemez)
ALTER TABLE buddy_swipes ADD COLUMN IF NOT EXISTS unmatched_at TIMESTAMP NULL;
