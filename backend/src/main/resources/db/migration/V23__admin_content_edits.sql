-- Admin panelinden düzenlenen mekân: bilet sitesi senkronları ad/şehir/adres/konumu ezmez.
-- (Sanatçı fotoğrafı için ayrı sütun gerekmez: artists.image_source = 'ADMIN' kilitler.)
-- Tekrar çalıştırılabilir. Canlıda elle çalıştırılır (yerelde ddl-auto=update ekler).
ALTER TABLE venues ADD COLUMN IF NOT EXISTS admin_edited BOOLEAN NULL;
