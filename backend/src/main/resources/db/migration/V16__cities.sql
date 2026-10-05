-- Uygulamanin kapsadigi sehirler (admin panelinden acilip kapatilir).
--
-- Yalnizca tablo olusturulur. 81 il ve ilk acik sehirler uygulama acilisinda
-- CityService tarafindan eklenir (app.launch.cities listesi; satir varsa dokunulmaz).
-- Uygulanmazsa uygulama app.launch.cities listesiyle calismaya devam eder.
-- Tekrar calistirilabilir.

CREATE TABLE IF NOT EXISTS cities (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(60) NOT NULL UNIQUE,
    slug        VARCHAR(60) NOT NULL UNIQUE,
    plate       INTEGER     NOT NULL,
    enabled     BOOLEAN     NOT NULL,
    updated_at  TIMESTAMP   NOT NULL
);
