-- =============================================================
--  CONCERTLY – CANLI GÖRÜNÜM İÇİN FAKE DATA
--  Tüm şifreler: test1234
--  pgAdmin'de bir kez çalıştır (Query Tool → F5)
-- =============================================================

DO $$
DECLARE
  -- User IDs
  u1  bigint; u2  bigint; u3  bigint; u4  bigint;
  u5  bigint; u6  bigint; u7  bigint; u8  bigint;
  u9  bigint; u10 bigint; u11 bigint; u12 bigint;
  -- Post IDs
  p1  bigint; p2  bigint; p3  bigint; p4  bigint;
  p5  bigint; p6  bigint; p7  bigint; p8  bigint;
  p9  bigint; p10 bigint; p11 bigint; p12 bigint;
  p13 bigint; p14 bigint; p15 bigint;
  -- Community IDs
  c_rock bigint; c_fest bigint; c_elek bigint;
  c_caz  bigint; c_ank  bigint;
  -- Event IDs (varsa kullan)
  ev1 bigint; ev2 bigint; ev3 bigint;
BEGIN

-- Zaten eklenmişse atla
IF EXISTS (SELECT 1 FROM users WHERE email = 'cem@fake.com') THEN
  RAISE NOTICE 'Fake data zaten mevcut, atlanıyor.';
  RETURN;
END IF;

-- ─────────────────────────────────────────────────────────────
-- KULLANICILАР
-- ─────────────────────────────────────────────────────────────
INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('cem_rock', 'cem@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Rock konserlerinin kaçmaz takipçisi 🎸', 'Istanbul', 'Rock,Metal', true, true,
        NOW()-'45 days'::interval, NOW()) RETURNING id INTO u1;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('ayse_festival', 'ayse@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Her yaz festival turu yapıyorum 🎪', 'Ankara', 'Festival,Pop', true, true,
        NOW()-'38 days'::interval, NOW()) RETURNING id INTO u2;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('burak_metal', 'burak@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Metalin gücü kafamda yaşıyor 🤘', 'Izmir', 'Metal,Rock', true, true,
        NOW()-'60 days'::interval, NOW()) RETURNING id INTO u3;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('selin_pop', 'selin@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Müzik olmadan bir gün bile geçiremem 🎵', 'Istanbul', 'Pop,Alternatif Rock', true, true,
        NOW()-'20 days'::interval, NOW()) RETURNING id INTO u4;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('mert_indie', 'mert@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Indie ve alternatif sahnesini yakından takip ediyorum', 'Bursa', 'Indie,Alternatif Rock', true, true,
        NOW()-'55 days'::interval, NOW()) RETURNING id INTO u5;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('deniz_jazz', 'deniz@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Caz gecelerine aşığım 🎷', 'Istanbul', 'Caz,Elektronik', true, true,
        NOW()-'30 days'::interval, NOW()) RETURNING id INTO u6;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('pinar_elektro', 'pinar@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Elektronik müzik benim dilim 🎧', 'Ankara', 'Elektronik', true, true,
        NOW()-'15 days'::interval, NOW()) RETURNING id INTO u7;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('kerem_altr', 'kerem@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Sahne önünde olmak en iyi his 🎸', 'Izmir', 'Alternatif Rock,Rock', true, true,
        NOW()-'42 days'::interval, NOW()) RETURNING id INTO u8;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('elif_konser', 'elif@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Konsere gitmek benim terapim 💙', 'Istanbul', 'Pop,Rock,Caz', true, true,
        NOW()-'28 days'::interval, NOW()) RETURNING id INTO u9;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('can_muzik', 'can@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Müzik hayatımın vazgeçilmezi', 'Ankara', 'Rap,Pop', true, true,
        NOW()-'50 days'::interval, NOW()) RETURNING id INTO u10;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('zeynep_sahne', 'zeynep@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Sahnede enerji bitmez 🌟', 'Istanbul', 'Pop,Festival', true, true,
        NOW()-'35 days'::interval, NOW()) RETURNING id INTO u11;

INSERT INTO users (username, email, password, bio, city, favorite_genres, onboarding_completed, is_active, created_at, updated_at)
VALUES ('ali_beats', 'ali@fake.com', '$2b$10$epnt3zSANupYz6mM4Bdu2ugewmQUPORzVjjaJvsY520SFUmKRDHCS',
        'Bass benim kalbim 🎛️', 'Izmir', 'Elektronik,Rap', true, true,
        NOW()-'25 days'::interval, NOW()) RETURNING id INTO u12;

-- ─────────────────────────────────────────────────────────────
-- COMMUNITY ve EVENT ID'LERİ AL
-- ─────────────────────────────────────────────────────────────
SELECT id INTO c_rock FROM communities WHERE type = 'Rock'      LIMIT 1;
SELECT id INTO c_fest FROM communities WHERE type = 'Festival'  LIMIT 1;
SELECT id INTO c_elek FROM communities WHERE type = 'Elektronik' LIMIT 1;
SELECT id INTO c_caz  FROM communities WHERE type = 'Caz'       LIMIT 1;
SELECT id INTO c_ank  FROM communities WHERE type = 'Sehir'     LIMIT 1;

SELECT id INTO ev1 FROM events ORDER BY id LIMIT 1 OFFSET 0;
SELECT id INTO ev2 FROM events ORDER BY id LIMIT 1 OFFSET 1;
SELECT id INTO ev3 FROM events ORDER BY id LIMIT 1 OFFSET 2;

-- ─────────────────────────────────────────────────────────────
-- TAKİP İLİŞKİLERİ
-- ─────────────────────────────────────────────────────────────
INSERT INTO follows (follower_id, following_id) VALUES
  (u1,u2),(u1,u3),(u1,u8),(u1,u9),(u1,u11),
  (u2,u1),(u2,u4),(u2,u9),(u2,u11),
  (u3,u1),(u3,u5),(u3,u8),(u3,u10),
  (u4,u1),(u4,u2),(u4,u9),(u4,u11),(u4,u6),
  (u5,u3),(u5,u8),(u5,u6),(u5,u1),
  (u6,u7),(u6,u12),(u6,u9),(u6,u1),
  (u7,u6),(u7,u12),(u7,u2),
  (u8,u1),(u8,u3),(u8,u5),(u8,u9),
  (u9,u4),(u9,u11),(u9,u2),(u9,u1),
  (u10,u1),(u10,u2),(u10,u4),(u10,u9),
  (u11,u4),(u11,u9),(u11,u2),(u11,u1),
  (u12,u6),(u12,u7),(u12,u10)
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- POSTLAR
-- ─────────────────────────────────────────────────────────────
INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Duman konserinden yeni kalktım. Kaan Tangöze sahneye girdiği an tüm salonun enerjisi değişti. Hayatımın en iyi gecelerinden biri 🎸🔥',
        'TEXT', u1, ev1, NOW()-'3 days 2 hours'::interval, NOW()) RETURNING id INTO p1;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Dolu Kadehi Ters Tut''u ilk kez canlı gördüm bu akşam. ''Uzun İnce Bir Yoldayım''ı tüm salon söyledi, gözlerim doldu. Bu ülkede müzik hâlâ yaşıyor ❤️',
        'TEXT', u2, ev2, NOW()-'5 days'::interval, NOW()) RETURNING id INTO p2;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('She Past Away konseri farklı bir boyuta taşıdı beni. Gotik atmosfer, lavanta kokusu, karanlık ışıklar... Sanki başka bir dünyaydı 🖤',
        'TEXT', u3, ev3, NOW()-'7 days'::interval, NOW()) RETURNING id INTO p3;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Ezhel sahneye çıkınca izdiham oldu ama değdi! Her şarkıda kalabalık onu tamamladı. ''Müptezhel''i söylerken tüyler diken diken oldu 🎤',
        'TEXT', u4, ev1, NOW()-'2 days 5 hours'::interval, NOW()) RETURNING id INTO p4;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Mor ve Ötesi yarım kalan konser borcunu bu sefer kapattı! ''Büyük Ev Ablukada''ya tüm salon ayakta eşlik etti. Unutulmaz bir gece 🎸',
        'TEXT', u5, ev2, NOW()-'10 days'::interval, NOW()) RETURNING id INTO p5;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Caz festivali için gittiğim Ankara''dan dönüyorum. Türkiye''nin bu kadar güçlü bir caz sahnesinin olduğunu bilmiyordum 🎷 Kesinlikle tekrar geleceğim.',
        'TEXT', u6, NULL, NOW()-'4 days 3 hours'::interval, NOW()) RETURNING id INTO p6;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('BUN setini izlemek için Ankara''dan İstanbul''a geldim, kesinlikle değdi. Elektronik müziği bu kadar derin bir sahne performansıyla dinlemek bambaşka 🎧',
        'TEXT', u7, ev3, NOW()-'1 day 6 hours'::interval, NOW()) RETURNING id INTO p7;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Son Feci Bisiklet bu sefer akustik setti. Seslerin ham hali daha güçlü bazen. Kafadan vurulmuş gibi çıktım salondan 🎵',
        'TEXT', u8, ev1, NOW()-'6 days'::interval, NOW()) RETURNING id INTO p8;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Tarkan sahne almadan önce beklerken tüm salon titriyordu. 20 yıldır aynı enerji, aynı karizm. Efsane kelimesi bunun için var 👑',
        'TEXT', u9, ev2, NOW()-'8 days'::interval, NOW()) RETURNING id INTO p9;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Sagopa Kajmer''i bu kadar duygusal hiç görmedim. Mikrofonu bıraktı, seyirci şarkıyı bitirdi. Derin bir andı, kelimelere sığmıyor 🎤',
        'TEXT', u10, NULL, NOW()-'12 days'::interval, NOW()) RETURNING id INTO p10;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Hipermob yeni single''ı canlı çaldı, kimse bilmiyordu. Salonun yarısı ne söylediğini anlamadı ama hissi muazzamdı 💿 Albüm çıkana kadar dinleyeceğim.',
        'TEXT', u11, ev3, NOW()-'3 days 8 hours'::interval, NOW()) RETURNING id INTO p11;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('hey! doug setini kaçıran herkese üzüldüm. Dans pistinde sabaha kadar kaldık. Beyin tamamen kapandı, sadece ritim vardı 🔊',
        'TEXT', u12, ev1, NOW()-'2 days'::interval, NOW()) RETURNING id INTO p12;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Metallica''yı Türkiye''de görmek hâlâ rüya gibi geliyor. ''Master of Puppets'' başlayınca 60.000 kişinin tek ses olması... kelimelerin ötesinde 🤘',
        'TEXT', u3, NULL, NOW()-'15 days'::interval, NOW()) RETURNING id INTO p13;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Mabel Matiz konseri saatin nasıl geçtiğini anlayamadım. Sahneyle izleyici arasında sınır yoktu, hepimiz birlikte şarkı söyledik ✨',
        'TEXT', u4, ev2, NOW()-'9 days'::interval, NOW()) RETURNING id INTO p14;

INSERT INTO posts (content, post_type, user_id, event_id, created_at, updated_at)
VALUES ('Can Bonomo akustik gece, küçük mekanda 200 kişiyle. Bu samimilik büyük sahnelerde olmuyor. Müzisyen ve insan olarak adam 🎸',
        'TEXT', u9, NULL, NOW()-'14 days'::interval, NOW()) RETURNING id INTO p15;

-- ─────────────────────────────────────────────────────────────
-- YORUMLAR
-- ─────────────────────────────────────────────────────────────
INSERT INTO comments (content, user_id, post_id, created_at) VALUES
  -- p1 – Duman
  ('Ben de oradaydım! ''Senden Daha Güzel''de salon inanılmaz coştu 🔥', u4, p1, NOW()-'3 days 1 hour'::interval),
  ('Kaan Tangöze''nin o solo geçişleri insanı eritiyor. Haklısın 😮', u8, p1, NOW()-'3 days 30 minutes'::interval),
  ('Keşke ben de gelebilseydim, bilet yoktu 😭 Bir dahaki gelişlerini kaçırmayacağım', u2, p1, NOW()-'2 days 22 hours'::interval),
  ('Setliste neler vardı? En çok hangi şarkıyı istedi salon?', u5, p1, NOW()-'2 days 20 hours'::interval),

  -- p2 – Dolu Kadehi
  ('Onları canlı dinlemek başka, stüdyo kaydı asla yetmiyor', u1, p2, NOW()-'4 days 20 hours'::interval),
  ('Aynı his bende de vardı, salon o an bir bütün oldu 💙', u9, p2, NOW()-'4 days 18 hours'::interval),
  ('Hangi şehirdeydi bu? Turları takip ediyorum ama kaçırıyorum sürekli', u11, p2, NOW()-'4 days 10 hours'::interval),

  -- p3 – She Past Away
  ('She Past Away konser deneyimi ayrı bir evren, yıllardır hayalim 🖤', u7, p3, NOW()-'6 days 23 hours'::interval),
  ('Gotik müzik bu kadar canlı dinlenince tüm anlamı değişiyor', u5, p3, NOW()-'6 days 21 hours'::interval),
  ('Mekân nasıldı, kapasite küçük müydü? Bilet bulmak zor mu?', u6, p3, NOW()-'6 days 18 hours'::interval),

  -- p4 – Ezhel
  ('Müptezhel''i söylerken kalabalığa kameralar döndü, o an efsaneydi 🎤', u10, p4, NOW()-'2 days 3 hours'::interval),
  ('Ezhel enerjisi sahnede 10 kat daha yoğun geliyor, inanılmaz performans', u12, p4, NOW()-'2 days 2 hours'::interval),
  ('Bilet bulmak cehennemi andırıyordu ama değdi kesinlikle!', u3, p4, NOW()-'1 day 22 hours'::interval),

  -- p5 – Mor ve Ötesi
  ('Büyük Ev''de salon yerinden oynadı 🤘 İstanbul rock sahnesinin en iyisi', u1, p5, NOW()-'9 days 20 hours'::interval),
  ('Onları her konserinde izliyorum, her seferinde farklı bir his yaşatıyorlar', u8, p5, NOW()-'9 days 18 hours'::interval),

  -- p7 – BUN
  ('O drop geldiğinde salon dondu kaldı 😵 Sesin ağırlığı göğsüme işledi', u12, p7, NOW()-'1 day 3 hours'::interval),
  ('Elektronik konser atmosferi gerçekten başka, ışıklarla birleşince mükemmel', u6, p7, NOW()-'1 day 1 hour'::interval),

  -- p9 – Tarkan
  ('Tarkan 20 yıl önce ne idiyse şimdi de aynısı, inanılmaz bir enerji 👑', u4, p9, NOW()-'7 days 22 hours'::interval),
  ('Sahne varlığı denen şey işte bu, kimse tartışamaz', u11, p9, NOW()-'7 days 20 hours'::interval),

  -- p12 – hey!doug
  ('Sabaha kadar dans, sonrası hafıza kaydı yok 😂 En iyi gece buydu', u7, p12, NOW()-'1 day 20 hours'::interval),
  ('Elektronik sahne bu enerjide başka yerde yok gerçekten', u6, p12, NOW()-'1 day 18 hours'::interval),

  -- p13 – Metallica
  ('Metallica Türkiye''ye gelseydi 10 saat arabayla bile giderdim 🤘', u1, p13, NOW()-'14 days'::interval),
  ('Master of Puppets o kalabalıkla muhteşem olmuş olmalı, fotoğraf var mı?', u8, p13, NOW()-'13 days 22 hours'::interval),

  -- p14 – Mabel Matiz
  ('Mabel Matiz sahnesini hiç kaçırmıyorum, her konser ayrı deneyim', u6, p14, NOW()-'8 days 22 hours'::interval),
  ('O samimiyet gerçekten nadir bir şey büyük sahnelerde 💛', u11, p14, NOW()-'8 days 20 hours'::interval),

  -- p15 – Can Bonomo
  ('Küçük mekân konserleri başka bir şey, o enerji tekrarlanmıyor', u2, p15, NOW()-'13 days 20 hours'::interval),
  ('Can Bonomo akustikte çok daha güçlü çıkıyor, harika tercih', u6, p15, NOW()-'13 days 18 hours'::interval);

-- ─────────────────────────────────────────────────────────────
-- BEĞENİLER
-- ─────────────────────────────────────────────────────────────
INSERT INTO likes (user_id, post_id) VALUES
  -- p1 (7 beğeni)
  (u2,p1),(u3,p1),(u4,p1),(u5,p1),(u8,p1),(u9,p1),(u11,p1),
  -- p2 (5 beğeni)
  (u1,p2),(u3,p2),(u6,p2),(u9,p2),(u10,p2),
  -- p3 (5 beğeni)
  (u1,p3),(u4,p3),(u6,p3),(u7,p3),(u9,p3),
  -- p4 (6 beğeni)
  (u1,p4),(u3,p4),(u6,p4),(u8,p4),(u10,p4),(u12,p4),
  -- p5 (5 beğeni)
  (u2,p5),(u4,p5),(u6,p5),(u8,p5),(u9,p5),
  -- p6 (4 beğeni)
  (u1,p6),(u7,p6),(u9,p6),(u12,p6),
  -- p7 (4 beğeni)
  (u4,p7),(u6,p7),(u9,p7),(u12,p7),
  -- p8 (4 beğeni)
  (u1,p8),(u3,p8),(u5,p8),(u9,p8),
  -- p9 (5 beğeni)
  (u2,p9),(u4,p9),(u6,p9),(u10,p9),(u11,p9),
  -- p10 (3 beğeni)
  (u1,p10),(u4,p10),(u9,p10),
  -- p11 (4 beğeni)
  (u4,p11),(u7,p11),(u9,p11),(u12,p11),
  -- p12 (4 beğeni)
  (u4,p12),(u6,p12),(u7,p12),(u9,p12),
  -- p13 (6 beğeni)
  (u1,p13),(u4,p13),(u5,p13),(u8,p13),(u9,p13),(u11,p13),
  -- p14 (4 beğeni)
  (u1,p14),(u6,p14),(u9,p14),(u11,p14),
  -- p15 (3 beğeni)
  (u2,p15),(u6,p15),(u11,p15)
ON CONFLICT (user_id, post_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- TOPLULUK ÜYELİKLERİ
-- ─────────────────────────────────────────────────────────────
IF c_rock IS NOT NULL THEN
  INSERT INTO community_members (user_id, community_id, joined_at) VALUES
    (u1, c_rock, NOW()-'40 days'::interval),
    (u3, c_rock, NOW()-'55 days'::interval),
    (u5, c_rock, NOW()-'30 days'::interval),
    (u8, c_rock, NOW()-'38 days'::interval),
    (u9, c_rock, NOW()-'20 days'::interval),
    (u4, c_rock, NOW()-'15 days'::interval)
  ON CONFLICT (user_id, community_id) DO NOTHING;
END IF;

IF c_fest IS NOT NULL THEN
  INSERT INTO community_members (user_id, community_id, joined_at) VALUES
    (u2, c_fest, NOW()-'35 days'::interval),
    (u4, c_fest, NOW()-'18 days'::interval),
    (u9, c_fest, NOW()-'25 days'::interval),
    (u11, c_fest, NOW()-'30 days'::interval),
    (u6, c_fest, NOW()-'28 days'::interval)
  ON CONFLICT (user_id, community_id) DO NOTHING;
END IF;

IF c_elek IS NOT NULL THEN
  INSERT INTO community_members (user_id, community_id, joined_at) VALUES
    (u6, c_elek, NOW()-'28 days'::interval),
    (u7, c_elek, NOW()-'14 days'::interval),
    (u12, c_elek, NOW()-'22 days'::interval),
    (u4, c_elek, NOW()-'10 days'::interval)
  ON CONFLICT (user_id, community_id) DO NOTHING;
END IF;

IF c_caz IS NOT NULL THEN
  INSERT INTO community_members (user_id, community_id, joined_at) VALUES
    (u6, c_caz, NOW()-'26 days'::interval),
    (u9, c_caz, NOW()-'20 days'::interval),
    (u1, c_caz, NOW()-'12 days'::interval)
  ON CONFLICT (user_id, community_id) DO NOTHING;
END IF;

IF c_ank IS NOT NULL THEN
  INSERT INTO community_members (user_id, community_id, joined_at) VALUES
    (u2, c_ank, NOW()-'36 days'::interval),
    (u7, c_ank, NOW()-'13 days'::interval),
    (u10, c_ank, NOW()-'48 days'::interval)
  ON CONFLICT (user_id, community_id) DO NOTHING;
END IF;

-- ─────────────────────────────────────────────────────────────
-- TOPLULUK POSTLARI
-- ─────────────────────────────────────────────────────────────
IF c_rock IS NOT NULL THEN
  INSERT INTO community_posts (content, user_id, community_id, created_at, updated_at) VALUES
    ('Bu hafta Dorock''ta harika bir set vardı, gidenler bilir 🎸 Sonraki etkinliği takip edin!',
     u1, c_rock, NOW()-'4 days'::interval, NOW()),
    ('Rock''un Türkiye''de bu kadar canlı olduğunu görünce gerçekten gurur duyuyorum. Sahne büyüyor 🤘',
     u8, c_rock, NOW()-'3 days'::interval, NOW()),
    ('Pentagram konserini kaçıranlar var mı? Bir daha geldiklerinde kesinlikle kaçırmayın',
     u3, c_rock, NOW()-'2 days'::interval, NOW()),
    ('Duman''ın yeni turu için bilet aldınız mı? Ankara tarihini kaçırmayalım',
     u5, c_rock, NOW()-'1 day'::interval, NOW());
END IF;

IF c_fest IS NOT NULL THEN
  INSERT INTO community_posts (content, user_id, community_id, created_at, updated_at) VALUES
    ('Yaz festivali biletleri ne zaman çıkıyor?? Sabırsızlıkla bekliyorum 🎪',
     u2, c_fest, NOW()-'5 days'::interval, NOW()),
    ('Geçen yıl kamp alanında tanıştığım insanlarla hâlâ arkadaşım. Festival başka bir şey ❤️',
     u11, c_fest, NOW()-'3 days 12 hours'::interval, NOW()),
    ('Festival bilet fiyatları bu yıl biraz ağır ama harcamaya kesinlikle değiyor',
     u4, c_fest, NOW()-'2 days 6 hours'::interval, NOW()),
    ('Kamp ekipmanı önerileri? İlk kez çadırda geceleyeceğim 😅',
     u9, c_fest, NOW()-'18 hours'::interval, NOW());
END IF;

IF c_elek IS NOT NULL THEN
  INSERT INTO community_posts (content, user_id, community_id, created_at, updated_at) VALUES
    ('BUN ve hey!doug aynı gecede iki ayrı mekanda, nasıl karar vereceğim 😭',
     u7, c_elek, NOW()-'6 days'::interval, NOW()),
    ('Elektronik müziği kulaklıkla değil, büyük soundsystem''de duymak şart. Fark başka boyutta',
     u12, c_elek, NOW()-'4 days 6 hours'::interval, NOW()),
    ('İstanbul''daki underground sahneler büyüyor, takip edin 🎧',
     u6, c_elek, NOW()-'1 day 12 hours'::interval, NOW());
END IF;

IF c_caz IS NOT NULL THEN
  INSERT INTO community_posts (content, user_id, community_id, created_at, updated_at) VALUES
    ('Ankara caz festivali bu yıl gerçekten üst seviyeydi. Harika sanatçılar vardı 🎷',
     u6, c_caz, NOW()-'4 days'::interval, NOW()),
    ('Küçük caz kulüplerinde yaşanan o samimiyet büyük sahnelerde olmuyor hiç',
     u9, c_caz, NOW()-'2 days'::interval, NOW());
END IF;

RAISE NOTICE 'Fake data başarıyla eklendi! 12 kullanıcı, 15 post, yorumlar, beğeniler ve topluluk içerikleri hazır.';

END $$;
