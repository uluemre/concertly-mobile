-- =============================================================
--  CONCERTLY – OYUN ÖZELLİKLERİ İÇİN DEMO VERİSİ
--  Gerekli: seed_fake_data.sql önce çalıştırılmış olmalı
--  (fake kullanıcıları oradan alır)
--  pgAdmin'de bir kez çalıştır (Query Tool → F5)
--
--  Doldurduğu ekranlar:
--   • Şarkı Testi skor tablosu (Hadise + Tarkan)
--   • Günün Şarkısı "bugün X kişi oynadı · %Y bildi" istatistiği
--   • Setlist Tahmin Ligi (yaklaşan etkinlikte tahmin sayacı,
--     geçmiş etkinlikte puanlanmış lig tablosu)
--   • DM gelen kutusu (fake kullanıcılardan hoş geldin mesajları)
-- =============================================================

DO $$
DECLARE
  fake_ids bigint[];
  real_ids bigint[];
  fid bigint;
  rid bigint;
  today_epoch bigint := (CURRENT_DATE - DATE '1970-01-01');
  ev_future bigint;   -- sanatçılı yaklaşan etkinlik
  ev_past   bigint;   -- sanatçılı geçmiş etkinlik
  i int;
BEGIN

-- Zaten eklenmişse atla
IF EXISTS (
  SELECT 1 FROM quiz_scores
  WHERE artist_name = 'Hadise'
    AND user_id IN (SELECT id FROM users WHERE email LIKE '%@fake.com')
) THEN
  RAISE NOTICE 'Oyun demo verisi zaten mevcut, atlanıyor.';
  RETURN;
END IF;

-- Fake kullanıcılar (seed_fake_data.sql ile gelmiş olmalı)
SELECT array_agg(id ORDER BY id) INTO fake_ids
FROM users WHERE email LIKE '%@fake.com';

IF fake_ids IS NULL OR array_length(fake_ids, 1) < 6 THEN
  RAISE NOTICE 'Fake kullanıcı bulunamadı — önce seed_fake_data.sql çalıştır.';
  RETURN;
END IF;

-- Gerçek hesaplar (DM hedefi): fake ve debug olmayan herkes
SELECT array_agg(id) INTO real_ids
FROM users
WHERE email NOT LIKE '%@fake.com'
  AND email <> 'claude_debug@test.com';

-- ─────────────────────────────────────────────────────────────
-- 1) ŞARKI TESTİ SKORLARI — Hadise lig tablosu
-- ─────────────────────────────────────────────────────────────
INSERT INTO quiz_scores (user_id, artist_name, score, correct_count, total_questions, duration_ms, created_at) VALUES
  (fake_ids[1], 'Hadise', 1860, 10, 10, 31200, NOW() - '2 days'::interval),
  (fake_ids[2], 'Hadise', 1715,  9, 10, 38500, NOW() - '1 day'::interval),
  (fake_ids[3], 'Hadise', 1540,  9, 10, 47900, NOW() - '3 days'::interval),
  (fake_ids[4], 'Hadise', 1310,  8, 10, 52300, NOW() - '5 hours'::interval),
  (fake_ids[5], 'Hadise', 1120,  7, 10, 61800, NOW() - '4 days'::interval),
  (fake_ids[6], 'Hadise',  940,  6, 10, 70400, NOW() - '6 days'::interval),
  (fake_ids[1], 'Tarkan',  1620,  9, 10, 42100, NOW() - '1 day'::interval),
  (fake_ids[3], 'Tarkan',  1380,  8, 10, 49600, NOW() - '2 days'::interval),
  (fake_ids[5], 'Tarkan',  1050,  7, 10, 63000, NOW() - '3 days'::interval);

-- ─────────────────────────────────────────────────────────────
-- 2) GÜNÜN ŞARKISI — bugünün istatistikleri + dünden seri izi
-- ─────────────────────────────────────────────────────────────
FOR i IN 1..LEAST(10, array_length(fake_ids, 1)) LOOP
  fid := fake_ids[i];
  -- bugün: ~%60 bildi (1-4. denemede), kalanı bilemedi
  IF i % 5 <> 0 THEN
    INSERT INTO daily_song_plays (user_id, epoch_day, attempts_used, solved, solved_attempt, created_at)
    VALUES (fid, today_epoch, 1 + (i % 4), (i % 3 <> 0), CASE WHEN i % 3 <> 0 THEN 1 + (i % 4) ELSE 0 END, NOW());
  END IF;
  -- dün ve önceki gün: seri hissi için birkaç çözüm
  IF i <= 5 THEN
    INSERT INTO daily_song_plays (user_id, epoch_day, attempts_used, solved, solved_attempt, created_at)
    VALUES (fid, today_epoch - 1, 2, true, 2, NOW() - '1 day'::interval);
    INSERT INTO daily_song_plays (user_id, epoch_day, attempts_used, solved, solved_attempt, created_at)
    VALUES (fid, today_epoch - 2, 3, true, 3, NOW() - '2 days'::interval);
  END IF;
END LOOP;

-- ─────────────────────────────────────────────────────────────
-- 3) SETLİST TAHMİN LİGİ
-- ─────────────────────────────────────────────────────────────
-- Yaklaşan sanatçılı etkinlik → tahmin sayacı dolu görünsün
SELECT e.id INTO ev_future FROM events e
WHERE e.artist_id IS NOT NULL AND e.event_date > NOW()
ORDER BY e.event_date ASC LIMIT 1;

IF ev_future IS NOT NULL THEN
  FOR i IN 1..6 LOOP
    INSERT INTO setlist_submissions (user_id, event_id, kind, titles, created_at)
    VALUES (fake_ids[i], ev_future, 'PREDICTION',
            'Açılış Şarkısı|En Büyük Hit|Yeni Single|Klasik Parça|Kapanış',
            NOW() - (i || ' hours')::interval);
  END LOOP;
END IF;

-- Geçmiş sanatçılı etkinlik → puanlanmış lig tablosu görünsün
SELECT e.id INTO ev_past FROM events e
WHERE e.artist_id IS NOT NULL AND e.event_date < NOW()
ORDER BY e.event_date DESC LIMIT 1;

IF ev_past IS NOT NULL THEN
  -- 3 katılımcı setlist bildirdi (çoğunluk: ilk 4 şarkı "çalındı" sayılır)
  INSERT INTO setlist_submissions (user_id, event_id, kind, titles, created_at) VALUES
    (fake_ids[1], ev_past, 'CONFIRMATION', 'Gece Yarısı|Sana Doğru|Son Dans|İlk Bakış|Bonus Parça', NOW()),
    (fake_ids[2], ev_past, 'CONFIRMATION', 'Gece Yarısı|Sana Doğru|Son Dans|İlk Bakış',             NOW()),
    (fake_ids[3], ev_past, 'CONFIRMATION', 'Gece Yarısı|Sana Doğru|Son Dans|İlk Bakış|Eski Hit',    NOW());
  -- tahminler: isabet sayıları farklı → sıralı lig
  INSERT INTO setlist_submissions (user_id, event_id, kind, titles, created_at) VALUES
    (fake_ids[4], ev_past, 'PREDICTION', 'Gece Yarısı|Sana Doğru|Son Dans|İlk Bakış|Bonus Parça', NOW() - '3 days'::interval),
    (fake_ids[5], ev_past, 'PREDICTION', 'Gece Yarısı|Sana Doğru|Eski Hit|Bilinmeyen',            NOW() - '3 days'::interval),
    (fake_ids[6], ev_past, 'PREDICTION', 'Bilinmeyen|Başka Şarkı|Eski Hit',                       NOW() - '4 days'::interval);
END IF;

-- ─────────────────────────────────────────────────────────────
-- 4) DM — gerçek hesapların gelen kutusuna mesajlar
-- ─────────────────────────────────────────────────────────────
IF real_ids IS NOT NULL THEN
  FOREACH rid IN ARRAY real_ids LOOP
    INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at) VALUES
      (fake_ids[1], rid, 'Selam! Hadise konserine sen de mi geliyorsun? 🎸', false, NOW() - '2 hours'::interval),
      (fake_ids[1], rid, 'Setlist tahminimi yaptım, Aşk Kaç Beden Giyer kesin çalar bence 😄', false, NOW() - '1 hour'::interval),
      (fake_ids[2], rid, 'Şarkı testinde 1715 yaptım, geç de görelim 🏆', false, NOW() - '30 minutes'::interval);
  END LOOP;
END IF;

RAISE NOTICE 'Oyun demo verisi eklendi: % quiz skoru, günlük şarkı oyunları, setlist ligi ve DM''ler.', 9;
END $$;
