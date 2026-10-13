-- Kullanıcı yönetimi: süreli yasak (users.banned_until) ve yaptırım geçmişi (uyarı, yasak,
-- yasak kaldırma, iç not). Tekrar çalıştırılabilir. Canlıda elle çalıştırılır
-- (yerelde ddl-auto=update ekler).
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS user_sanctions (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    type        VARCHAR(10)  NOT NULL,
    reason      VARCHAR(500) NULL,
    until_at    TIMESTAMP    NULL,
    admin_name  VARCHAR(255) NULL,
    created_at  TIMESTAMP    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_sanctions_user ON user_sanctions (user_id, created_at DESC);
