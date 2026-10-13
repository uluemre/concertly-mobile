-- Şikâyet kararı: hangi işlemle kapandı (DISMISS, HIDE, HIDE_WARN, HIDE_BAN, WARN, BAN),
-- kim ve ne zaman kapattı. Tekrar çalıştırılabilir. Canlıda elle (yerelde ddl-auto ekler).
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution VARCHAR(20) NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255) NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP NULL;
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports (target_type, target_id);
