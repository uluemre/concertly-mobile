-- N-08 / N-09: mukerrer sanatci ve mekanlarin YUMUSAK birlestirilmesi.
-- Birlestirilen kayit SILINMEZ; merged_into_* asil kaydin kimligini tutar.
-- NULL = aktif kayit (mevcut tum satirlar degismez). Tekrar calistirilabilir.

ALTER TABLE artists ADD COLUMN IF NOT EXISTS merged_into_artist_id BIGINT;
ALTER TABLE venues  ADD COLUMN IF NOT EXISTS merged_into_venue_id  BIGINT;

CREATE INDEX IF NOT EXISTS idx_artists_merged_into
    ON artists (merged_into_artist_id) WHERE merged_into_artist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venues_merged_into
    ON venues (merged_into_venue_id) WHERE merged_into_venue_id IS NOT NULL;
