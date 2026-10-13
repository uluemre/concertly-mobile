-- Organizatör hesabı: onaylanan başvurudan doğar; etkinlikler organizer_id ile bağlanır.
-- events.view_count organizatör panelindeki görüntülenme sayısıdır.
-- Tekrar çalıştırılabilir. Canlıda elle çalıştırılır (yerelde ddl-auto=update ekler).

CREATE TABLE IF NOT EXISTS organizers (
    id             BIGSERIAL     PRIMARY KEY,
    owner_user_id  BIGINT        NOT NULL REFERENCES users(id),
    name           VARCHAR(120)  NOT NULL,
    type           VARCHAR(20)   NOT NULL,
    bio            VARCHAR(1000) NULL,
    logo_url       VARCHAR(500)  NULL,
    website        VARCHAR(500)  NULL,
    instagram      VARCHAR(500)  NULL,
    verified       BOOLEAN       NOT NULL DEFAULT TRUE,
    can_announce   BOOLEAN       NOT NULL DEFAULT TRUE,
    active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP     NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizers_owner ON organizers (owner_user_id);

ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_id BIGINT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS view_count BIGINT NULL;
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events (organizer_id);

-- Daha önce onaylanmış başvurular için organizatör kaydı ve etkinlik bağı
INSERT INTO organizers (owner_user_id, name, type, website, instagram, verified, can_announce, active, created_at)
SELECT DISTINCT ON (r.user_id) r.user_id, r.organization_name, r.type, r.website, r.instagram,
       TRUE, TRUE, TRUE, coalesce(r.reviewed_at, now())
FROM organizer_requests r
WHERE r.status = 'APPROVED'
  AND NOT EXISTS (SELECT 1 FROM organizers o WHERE o.owner_user_id = r.user_id)
ORDER BY r.user_id, r.reviewed_at DESC NULLS LAST;

UPDATE events e SET organizer_id = o.id
FROM organizers o
WHERE e.organizer_id IS NULL AND e.source = 'ORGANIZER' AND e.created_by_user_id = o.owner_user_id;
