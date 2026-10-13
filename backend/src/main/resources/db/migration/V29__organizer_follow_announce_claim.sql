-- Organizatör O2-O4: takip, katılımcılara duyuru ve etkinlik sahiplenme talepleri.
-- Tekrar çalıştırılabilir. Canlıda elle (yerelde ddl-auto=update açar).
CREATE TABLE IF NOT EXISTS organizer_follows (
    id            BIGSERIAL PRIMARY KEY,
    organizer_id  BIGINT    NOT NULL,
    user_id       BIGINT    NOT NULL,
    created_at    TIMESTAMP NOT NULL,
    CONSTRAINT uq_organizer_follow UNIQUE (organizer_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_organizer_follows_user ON organizer_follows (user_id);

CREATE TABLE IF NOT EXISTS organizer_announcements (
    id            BIGSERIAL    PRIMARY KEY,
    organizer_id  BIGINT       NOT NULL,
    event_id      BIGINT       NOT NULL,
    message       VARCHAR(300) NOT NULL,
    audience      VARCHAR(20)  NOT NULL,
    recipients    INTEGER      NOT NULL,
    created_at    TIMESTAMP    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_announcements_event ON organizer_announcements (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_claims (
    id            BIGSERIAL     PRIMARY KEY,
    event_id      BIGINT        NOT NULL,
    organizer_id  BIGINT        NOT NULL,
    message       VARCHAR(1000) NULL,
    status        VARCHAR(20)   NOT NULL,
    review_note   VARCHAR(500)  NULL,
    reviewed_by   VARCHAR(255)  NULL,
    created_at    TIMESTAMP     NOT NULL,
    reviewed_at   TIMESTAMP     NULL
);
CREATE INDEX IF NOT EXISTS idx_event_claims_status ON event_claims (status, created_at);
