-- Benzersiz görüntülenme: her izleyici (kullanıcı ya da oturumsuz cihazın IP özeti) bir etkinliği
-- bir kez sayar. events.view_count yalnız yeni satır eklenince artar.
-- Tekrar çalıştırılabilir. Canlıda elle çalıştırılır (bu tablonun entity'si yok, ddl-auto açmaz).
CREATE TABLE IF NOT EXISTS event_views (
    event_id    BIGINT      NOT NULL,
    viewer_key  VARCHAR(80) NOT NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, viewer_key)
);
