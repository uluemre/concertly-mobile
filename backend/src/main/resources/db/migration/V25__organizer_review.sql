-- Organizatör başvurusu: adminlerin iç notu (başvurana gösterilmez) ve kararı veren admin.
-- Tekrar çalıştırılabilir. Canlıda elle çalıştırılır (yerelde ddl-auto=update ekler).
ALTER TABLE organizer_requests ADD COLUMN IF NOT EXISTS internal_note VARCHAR(1000) NULL;
ALTER TABLE organizer_requests ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255) NULL;
