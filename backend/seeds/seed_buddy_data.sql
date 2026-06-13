-- =============================================================
--  CONCERT BUDDY – FAKE ATTENDANCE & UPCOMING EVENTS
--  seed_fake_data.sql'den sonra çalıştır
-- =============================================================

DO $$
DECLARE
  -- Fake user IDs
  u1 bigint; u2 bigint; u3 bigint; u4 bigint;
  u5 bigint; u6 bigint; u7 bigint; u8 bigint;
  u9 bigint; u10 bigint; u11 bigint; u12 bigint;

  -- Event IDs (yaklaşan etkinlikler)
  ev1 bigint; ev2 bigint; ev3 bigint; ev4 bigint; ev5 bigint;

  -- Artist IDs
  a_duman   bigint; a_ezhel  bigint; a_mor    bigint;
  a_sfa     bigint; a_bun    bigint; a_tarkan bigint;

  -- Venue ID
  v1 bigint;
BEGIN

-- Zaten eklenmiş mi kontrol et
IF EXISTS (
  SELECT 1 FROM event_attendances ea
  JOIN users u ON u.id = ea.user_id
  WHERE u.email = 'cem@fake.com'
) THEN
  RAISE NOTICE 'Buddy fake data zaten mevcut, atlanıyor.';
  RETURN;
END IF;

-- Fake kullanıcı ID'lerini al
SELECT id INTO u1  FROM users WHERE email = 'cem@fake.com';
SELECT id INTO u2  FROM users WHERE email = 'ayse@fake.com';
SELECT id INTO u3  FROM users WHERE email = 'burak@fake.com';
SELECT id INTO u4  FROM users WHERE email = 'selin@fake.com';
SELECT id INTO u5  FROM users WHERE email = 'mert@fake.com';
SELECT id INTO u6  FROM users WHERE email = 'deniz@fake.com';
SELECT id INTO u7  FROM users WHERE email = 'pinar@fake.com';
SELECT id INTO u8  FROM users WHERE email = 'kerem@fake.com';
SELECT id INTO u9  FROM users WHERE email = 'elif@fake.com';
SELECT id INTO u10 FROM users WHERE email = 'can@fake.com';
SELECT id INTO u11 FROM users WHERE email = 'zeynep@fake.com';
SELECT id INTO u12 FROM users WHERE email = 'ali@fake.com';

IF u1 IS NULL THEN
  RAISE NOTICE 'Önce seed_fake_data.sql çalıştırın!';
  RETURN;
END IF;

-- Sanatçı ID'leri
SELECT id INTO a_duman   FROM artists WHERE name = 'Duman'       LIMIT 1;
SELECT id INTO a_ezhel   FROM artists WHERE name = 'Ezhel'       LIMIT 1;
SELECT id INTO a_mor     FROM artists WHERE name = 'Mor ve Otesi' LIMIT 1;
SELECT id INTO a_sfa     FROM artists WHERE name = 'She Past Away' LIMIT 1;
SELECT id INTO a_bun     FROM artists WHERE name = 'BUN'           LIMIT 1;
SELECT id INTO a_tarkan  FROM artists WHERE name = 'Tarkan'        LIMIT 1;

-- Mekan oluştur (yoksa)
INSERT INTO venues (name, city, country, address)
VALUES ('Zorlu PSM', 'Istanbul', 'Türkiye', 'Zorlu Center, Beşiktaş')
ON CONFLICT DO NOTHING;
SELECT id INTO v1 FROM venues WHERE name = 'Zorlu PSM' LIMIT 1;

-- ─────────────────────────────────────────────────────────────
-- YAKLAŞAN ETKİNLİKLER (önümüzdeki 3 ay)
-- ─────────────────────────────────────────────────────────────
INSERT INTO events (name, description, event_date, artist_id, venue_id, genre, is_approved)
VALUES (
  'Duman İstanbul Konseri 2026',
  'Duman, 2026 yaz turnesi kapsamında İstanbul''a geliyor. Unutulmaz bir rock gecesi sizi bekliyor.',
  NOW() + INTERVAL '18 days',
  a_duman, v1, 'Rock', true
) RETURNING id INTO ev1;

INSERT INTO events (name, description, event_date, artist_id, venue_id, genre, is_approved)
VALUES (
  'Ezhel Açık Hava',
  'Ezhel''in büyük açık hava konseri. Hip-hop sahnesinin en iyisi sahne alıyor.',
  NOW() + INTERVAL '32 days',
  a_ezhel, v1, 'Rap', true
) RETURNING id INTO ev2;

INSERT INTO events (name, description, event_date, artist_id, venue_id, genre, is_approved)
VALUES (
  'Mor ve Ötesi Akustik Gece',
  'Mor ve Ötesi, akustik setleriyle küçük bir mekanda müzikseverlerle buluşuyor.',
  NOW() + INTERVAL '45 days',
  a_mor, v1, 'Rock', true
) RETURNING id INTO ev3;

INSERT INTO events (name, description, event_date, artist_id, venue_id, genre, is_approved)
VALUES (
  'She Past Away Dark Night',
  'She Past Away''in gotik post-punk atmosferi İstanbul''u saracak.',
  NOW() + INTERVAL '28 days',
  a_sfa, v1, 'Rock', true
) RETURNING id INTO ev4;

INSERT INTO events (name, description, event_date, artist_id, venue_id, genre, is_approved)
VALUES (
  'BUN Electronic Set',
  'BUN''ın yeni albümü için özel elektronik set. Sahne ve ışık gösterisiyle unutulmaz gece.',
  NOW() + INTERVAL '21 days',
  a_bun, v1, 'Elektronik', true
) RETURNING id INTO ev5;

-- ─────────────────────────────────────────────────────────────
-- KATILIM KAYITLARI (fake kullanıcılar + gerçek kullanıcı eşleşsin)
-- ─────────────────────────────────────────────────────────────

-- ev1: Duman — u1, u3, u5, u8, u9 gidiyor
INSERT INTO event_attendances (user_id, event_id, status, created_at) VALUES
  (u1,  ev1, 'GOING', NOW() - INTERVAL '5 days'),
  (u3,  ev1, 'GOING', NOW() - INTERVAL '4 days'),
  (u5,  ev1, 'GOING', NOW() - INTERVAL '3 days'),
  (u8,  ev1, 'GOING', NOW() - INTERVAL '6 days'),
  (u9,  ev1, 'GOING', NOW() - INTERVAL '2 days'),
  (u4,  ev1, 'INTERESTED', NOW() - INTERVAL '1 day')
ON CONFLICT (user_id, event_id) DO NOTHING;

-- ev2: Ezhel — u2, u4, u10, u11, u12 gidiyor
INSERT INTO event_attendances (user_id, event_id, status, created_at) VALUES
  (u2,  ev2, 'GOING', NOW() - INTERVAL '7 days'),
  (u4,  ev2, 'GOING', NOW() - INTERVAL '5 days'),
  (u10, ev2, 'GOING', NOW() - INTERVAL '3 days'),
  (u11, ev2, 'GOING', NOW() - INTERVAL '4 days'),
  (u12, ev2, 'GOING', NOW() - INTERVAL '2 days'),
  (u6,  ev2, 'INTERESTED', NOW() - INTERVAL '1 day')
ON CONFLICT (user_id, event_id) DO NOTHING;

-- ev3: Mor ve Ötesi — u1, u2, u5, u8 gidiyor
INSERT INTO event_attendances (user_id, event_id, status, created_at) VALUES
  (u1,  ev3, 'GOING', NOW() - INTERVAL '8 days'),
  (u2,  ev3, 'GOING', NOW() - INTERVAL '6 days'),
  (u5,  ev3, 'GOING', NOW() - INTERVAL '4 days'),
  (u8,  ev3, 'GOING', NOW() - INTERVAL '3 days'),
  (u9,  ev3, 'INTERESTED', NOW() - INTERVAL '2 days')
ON CONFLICT (user_id, event_id) DO NOTHING;

-- ev4: She Past Away — u3, u6, u7, u9 gidiyor
INSERT INTO event_attendances (user_id, event_id, status, created_at) VALUES
  (u3,  ev4, 'GOING', NOW() - INTERVAL '6 days'),
  (u6,  ev4, 'GOING', NOW() - INTERVAL '5 days'),
  (u7,  ev4, 'GOING', NOW() - INTERVAL '4 days'),
  (u9,  ev4, 'GOING', NOW() - INTERVAL '3 days'),
  (u11, ev4, 'INTERESTED', NOW() - INTERVAL '1 day')
ON CONFLICT (user_id, event_id) DO NOTHING;

-- ev5: BUN Electronic — u6, u7, u12, u4 gidiyor
INSERT INTO event_attendances (user_id, event_id, status, created_at) VALUES
  (u6,  ev5, 'GOING', NOW() - INTERVAL '9 days'),
  (u7,  ev5, 'GOING', NOW() - INTERVAL '7 days'),
  (u12, ev5, 'GOING', NOW() - INTERVAL '5 days'),
  (u4,  ev5, 'GOING', NOW() - INTERVAL '3 days'),
  (u2,  ev5, 'INTERESTED', NOW() - INTERVAL '2 days')
ON CONFLICT (user_id, event_id) DO NOTHING;

RAISE NOTICE '✅ 5 yaklaşan etkinlik ve attendance kayıtları eklendi!';
RAISE NOTICE 'Artık Concert Buddy eşleşmeleri çalışacak.';
RAISE NOTICE 'İpucu: Uygulamada bir etkinliğe "Gidiyorum" ekle, ardından Konser Arkadaşı ekranına gir.';

END $$;
