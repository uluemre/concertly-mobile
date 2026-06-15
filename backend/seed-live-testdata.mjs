// Canlı Railway DB'sini gerçekçi test verisiyle dolduran tek seferlik script.
// Tamamen normal kullanıcı API akışını kullanır (admin/redeploy gerekmez).
// Çalıştır: node backend/seed-live-testdata.mjs
const BASE = 'https://concertly-mobile-production.up.railway.app/api';
const PW = 'Demo1234';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => {
  const c = [...a]; const out = [];
  while (c.length && out.length < n) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
  return out;
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const txt = await res.text();
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  return { status: res.status, data };
}

const USERS = [
  { username: 'ipek_aydin',    city: 'Istanbul', bio: 'Konser bağımlısı 🎸 her hafta bir sahne', genres: 'Rock,Pop' },
  { username: 'mert_kaya',     city: 'Ankara',   bio: 'Rap dinler, mosh pit\'te bulunur 🤘',     genres: 'Rap,Hip-Hop' },
  { username: 'zeynep_demir',  city: 'Izmir',    bio: 'Indie ruhu, akustik sever 🌿',           genres: 'Indie,Pop' },
  { username: 'can_yilmaz',    city: 'Istanbul', bio: 'Elektronik gece kaşifi 🎧',              genres: 'Elektronik,Techno' },
  { username: 'elif_sahin',    city: 'Bursa',    bio: 'Festival sezonu en sevdiğim zaman ☀️',  genres: 'Pop,Rock' },
  { username: 'burak_ozturk',  city: 'Antalya',  bio: 'Metal kalbi 🖤 gitar çalarım',          genres: 'Metal,Rock' },
  { username: 'selin_arslan',  city: 'Ankara',   bio: 'Türkçe pop kraliçesi 👑',               genres: 'Pop' },
  { username: 'deniz_celik',   city: 'Istanbul', bio: 'Caz ve blues benim işim 🎷',            genres: 'Caz,Blues' },
  { username: 'ece_korkmaz',   city: 'Izmir',    bio: 'Her konserde ön sıradayım 📸',          genres: 'Rock,Indie' },
  { username: 'kaan_dogan',    city: 'Eskişehir',bio: 'Müzik öğrencisi, her türü dinlerim',    genres: 'Rock,Caz' },
  { username: 'aslı_polat',    city: 'Istanbul', bio: 'Sahne ışıkları altında özgürüm ✨',     genres: 'Pop,Elektronik' },
  { username: 'emir_tas',      city: 'Adana',    bio: 'Anadolu rock hayranı 🎶',               genres: 'Rock' },
  { username: 'gizem_acar',    city: 'Bursa',    bio: 'Akustik akşamların müdavimi 🍷',        genres: 'Indie,Pop' },
  { username: 'onur_bulut',    city: 'Ankara',   bio: 'Konser fotoğrafçısı, anıları yakalarım',genres: 'Rock,Metal' },
];

const CAPTIONS = [
  'Bu konseri kaçırmak istemiyorum, biletler çoktan hazır! 🎫',
  'Sahne enerjisi efsane olacak, şimdiden sabırsızlanıyorum 🔥',
  'Kimler geliyor? Grup olup buluşalım 🙌',
  'Geçen seneki performansları inanılmazdı, yine oradayım kesin',
  'Bu akşam için playlist\'imi şimdiden hazırladım 🎶',
  'Arkadaşlarla kalabalık geliyoruz, çok eğleneceğiz',
  'Ön sıradan izlemek için erkenden gideceğim 📸',
  'Canlı performans bambaşka oluyor, herkese tavsiye ederim',
  'Bilet fiyatları gayet uygun, kaçırmayın derim',
  'Şehrimize böyle etkinlikler gelmesi çok güzel ❤️',
  'Akustik bir set olursa bayılırım, umarım çalarlar',
  'Geçen konserde sesim kısılmıştı, yine aynısı olacak 😄',
  'Bu sanatçıyı yıllardır canlı izlemek istiyordum, nihayet!',
  'Hava güzel olursa açık hava konseri tadından yenmez 🌙',
  'Biletimi aldım, geri sayım başladı ⏳',
];

const COMMENTS = [
  'Ben de oradayım, görüşürüz! 👋',
  'Hangi kapıdan gireceksiniz?',
  'Bilet kalmış mı acaba?',
  'Çok haklısın, efsane olacak 🔥',
  'Beraber gidelim mi?',
  'Geçen sefer de gitmiştim, pişman olmazsın',
  'Saat kaçta başlıyor bilen var mı?',
  'Vay be, kıskandım şimdi 😅',
  'Bu sanatçıya bayılıyorum ❤️',
  'Yorumun için sağ ol, ben de bilet alıyorum',
  'Açık hava ise çok daha iyi olur 🌟',
  'Umarım yeni şarkıları da çalar',
];

async function main() {
  console.log('1) Etkinlikler çekiliyor...');
  const ev = await api('/events?upcoming=true&limit=200');
  const events = Array.isArray(ev.data) ? ev.data : [];
  const eventIds = events.map((e) => e.id).filter(Boolean);
  const artistIds = [...new Set(events.map((e) => e.artistId || e.artist?.id).filter(Boolean))];
  console.log(`   ${eventIds.length} etkinlik, ${artistIds.length} sanatçı bulundu.`);
  if (eventIds.length === 0) { console.error('Etkinlik yok, çıkılıyor.'); return; }

  // 2) Kullanıcıları oluştur / giriş yap
  console.log('2) Kullanıcılar oluşturuluyor...');
  const accounts = [];
  for (const u of USERS) {
    const email = u.username.replace('_', '.').replace('ı', 'i') + '@concertlydemo.com';
    let token, userId;
    const reg = await api('/auth/register', { method: 'POST', body: { username: u.username, email, password: PW, city: u.city } });
    if (reg.status === 201 || reg.status === 200) {
      const login = await api('/auth/login', { method: 'POST', body: { email, password: PW } });
      token = login.data?.accessToken; userId = login.data?.userId;
    } else {
      // zaten varsa giriş dene
      const login = await api('/auth/login', { method: 'POST', body: { email, password: PW } });
      token = login.data?.accessToken; userId = login.data?.userId;
    }
    if (token) { accounts.push({ ...u, email, token, userId }); process.stdout.write(`   ✓ ${u.username}\n`); }
    else process.stdout.write(`   ✗ ${u.username} (status ${reg.status})\n`);
    await sleep(120);
  }
  console.log(`   ${accounts.length}/${USERS.length} hesap hazır.`);
  if (!accounts.length) return;

  // 3) Sanatçı + kullanıcı takipleri
  console.log('3) Takipler...');
  let followCount = 0;
  for (const a of accounts) {
    for (const aid of sample(artistIds, 4 + Math.floor(Math.random() * 3))) {
      const r = await api(`/artists/${aid}/follow`, { method: 'POST', token: a.token });
      if (r.status === 204) followCount++;
    }
    const others = accounts.filter((x) => x.userId !== a.userId);
    for (const o of sample(others, 3 + Math.floor(Math.random() * 3))) {
      await api(`/users/${o.userId}/follow`, { method: 'POST', token: a.token });
    }
    await sleep(80);
  }
  console.log(`   ${followCount} sanatçı takibi + kullanıcı takipleri yapıldı.`);

  // 4) Gönderiler
  console.log('4) Gönderiler oluşturuluyor...');
  const postIds = [];
  for (const a of accounts) {
    const n = 2 + Math.floor(Math.random() * 3); // 2-4 gönderi
    for (const eid of sample(eventIds, n)) {
      const r = await api('/posts', { method: 'POST', token: a.token, body: { eventId: eid, content: rnd(CAPTIONS), postType: 'TEXT' } });
      if ((r.status === 201 || r.status === 200) && r.data?.id) postIds.push(r.data.id);
      await sleep(70);
    }
  }
  console.log(`   ${postIds.length} gönderi oluşturuldu.`);

  // 5) Beğeniler
  console.log('5) Beğeniler...');
  let likes = 0;
  for (const a of accounts) {
    for (const pid of sample(postIds, 6 + Math.floor(Math.random() * 7))) {
      const r = await api(`/posts/${pid}/like`, { method: 'POST', token: a.token });
      if (r.status === 204) likes++;
    }
    await sleep(60);
  }
  console.log(`   ${likes} beğeni yapıldı.`);

  // 6) Yorumlar
  console.log('6) Yorumlar...');
  let comments = 0;
  for (const a of accounts) {
    for (const pid of sample(postIds, 3 + Math.floor(Math.random() * 3))) {
      const r = await api(`/posts/${pid}/comments`, { method: 'POST', token: a.token, body: { content: rnd(COMMENTS) } });
      if (r.status === 201 || r.status === 200) comments++;
      await sleep(60);
    }
  }
  console.log(`   ${comments} yorum yapıldı.`);

  console.log('\n✅ BİTTİ. Özet:');
  console.log(`   Kullanıcı: ${accounts.length} | Gönderi: ${postIds.length} | Beğeni: ${likes} | Yorum: ${comments}`);
  console.log(`   Tüm hesapların şifresi: ${PW}`);
  console.log(`   Örnek giriş: ${accounts[0].email} / ${PW}`);
}

main().catch((e) => { console.error('HATA:', e); process.exit(1); });
