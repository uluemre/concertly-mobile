-- Admin panelinden değiştirilen uygulama ayarları (bakım modu, duyuru, özellik anahtarları,
-- yeni hesap limitleri) ve admin işlem kaydı.
--
-- Tablo yoksa uygulama ayar dosyasındaki varsayılanlarla çalışır; yalnız admin
-- değişiklikleri kaydedilemez. Tekrar çalıştırılabilir. Canlıda elle çalıştırılır
-- (yerelde ddl-auto=update tabloları kendisi açar).

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key  VARCHAR(80)  PRIMARY KEY,
    value        TEXT         NULL,
    updated_at   TIMESTAMP    NOT NULL,
    updated_by   VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id           BIGSERIAL    PRIMARY KEY,
    admin_id     BIGINT       NULL,
    admin_name   VARCHAR(255) NULL,
    method       VARCHAR(10)  NOT NULL,
    path         VARCHAR(255) NOT NULL,
    status       INTEGER      NOT NULL,
    detail       TEXT         NULL,
    created_at   TIMESTAMP    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log (admin_id);
