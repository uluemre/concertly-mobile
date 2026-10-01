-- B5: topluluk inceleme suresinin basladigi an (24 sa gizli / 7 gun otomatik ret). NULL = created_at kullanilir.
ALTER TABLE communities ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMP;

-- B11: topluluk gonderi/yorumlari icin moderasyonla gizleme (kayit silinmez). NULL = gizli degil.
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE community_post_comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
