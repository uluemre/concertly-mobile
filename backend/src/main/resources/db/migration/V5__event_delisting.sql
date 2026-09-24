-- Etkinligi SILMEDEN listelerden kaldirma.
--
-- Konser olmayan (tiyatro, stand-up, sergi) Ticketmaster kayitlari bununla
-- gizlenir: is_approved = false + delisted_reason = 'NOT_MUSIC'. Katilimlar,
-- postlar ve yorumlar yerinde kalir; admin onaylarsa kayit geri doner.

ALTER TABLE events ADD COLUMN IF NOT EXISTS delisted_reason VARCHAR(40);
