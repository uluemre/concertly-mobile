// Mevcut /uploads/ görsellerini Cloudflare R2 kovasına kopyalayan tek seferlik script.
// Bağımlılık yok (Node 18+ fetch + crypto, veritabanı için psql).
//
// Veritabanındaki tüm metin kolonlarını tarar, "/uploads/<dosya>" geçen her değeri
// toplar; her dosyayı önce yerel klasörde, yoksa çalışan sunucudan (SOURCE_ORIGIN)
// arar ve kovada yoksa yükler. Varsayılan KURU ÇALIŞMA — yazmak için --apply.
//
// Örnek (canlı; Render'da disk kalıcı olmadığı için R2'li sürüm deploy edilmeden ÖNCE):
//   DATABASE_URL="postgresql://...neon..." SOURCE_ORIGIN=https://concertly-api.onrender.com \
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=concertly-uploads \
//   node backend/scripts/migrate-uploads-to-r2.mjs --apply
//
// Yerel: DATABASE_URL=postgresql://postgres:1234@localhost/concertly_mobile UPLOAD_DIR=backend/uploads ...
// PSQL ile psql.exe yolunu verebilirsin (varsayılan: PATH'teki psql).
// --list: yalnızca veritabanındaki görsel anahtarlarını yazar (R2 bilgisi gerekmez).
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const LIST_ONLY = process.argv.includes('--list');
const env = (k, fallback) => {
  const v = process.env[k] ?? fallback;
  if (v === undefined || v === '') { console.error(`Eksik ortam değişkeni: ${k}`); process.exit(1); }
  return v;
};

const DATABASE_URL = env('DATABASE_URL');
const PSQL = process.env.PSQL || 'psql';
const UPLOAD_DIR = process.env.UPLOAD_DIR || '';
const SOURCE_ORIGIN = (process.env.SOURCE_ORIGIN || '').replace(/\/$/, '');

// Sunucudaki R2ImageStorage ile aynı değerler
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONTENT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const KEY_RE = /^[A-Za-z0-9-]{1,64}\.[a-z]{2,5}$/;

// Parola komut satırına yazılmaz (süreç listesinde görünür): URL'den çıkarılıp
// PGPASSWORD ile verilir.
const PSQL_TARGET = (() => {
  try {
    const u = new URL(DATABASE_URL);
    const password = decodeURIComponent(u.password);
    u.password = '';
    return { url: u.toString(), env: password ? { ...process.env, PGPASSWORD: password } : process.env };
  } catch {
    return { url: DATABASE_URL, env: process.env };
  }
})();

function psql(sql) {
  return execFileSync(PSQL, ['-d', PSQL_TARGET.url, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8', env: PSQL_TARGET.env })
    .split(/\r?\n/).filter(Boolean);
}

function collectKeys() {
  const cols = psql(`select quote_ident(table_name) || '|' || quote_ident(column_name)
    from information_schema.columns c
    where table_schema = 'public' and data_type in ('text', 'character varying')
      and exists (select 1 from information_schema.tables t
                  where t.table_schema = 'public' and t.table_name = c.table_name and t.table_type = 'BASE TABLE')`);
  if (!cols.length) return [];
  const parts = cols.map((tc) => {
    const [t, c] = tc.split('|');
    return `select (regexp_matches(${c}, '/uploads/([A-Za-z0-9._-]+)', 'g'))[1] as k from ${t} where ${c} like '%/uploads/%'`;
  });
  return [...new Set(psql(`select distinct k from (${parts.join(' union all ')}) x`))].sort();
}

// ── SigV4 (sunucudaki S3Signer ile aynı) ─────────────────────────────────────
const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();

function signedHeaders(method, path, headers, payloadHash) {
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const date = amzDate.slice(0, 8);
  const all = { ...headers, host: HOST, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(all).map((k) => k.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonical = [method, path, '', names.map((n) => `${n}:${lower[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  let key = hmac(`AWS4${SECRET_KEY}`, date);
  for (const part of ['auto', 's3', 'aws4_request']) key = hmac(key, part);
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  const { host, ...rest } = all; // host'u fetch kendisi yazar
  return { ...rest, authorization: `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope},SignedHeaders=${names.join(';')},Signature=${signature}` };
}

const objectPath = (key) => `/${encodeURIComponent(BUCKET)}/${encodeURIComponent(key)}`;

async function existsInBucket(key) {
  const path = objectPath(key);
  const res = await fetch(`https://${HOST}${path}`, { method: 'HEAD', headers: signedHeaders('HEAD', path, {}, sha256('')) });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`HEAD ${key}: HTTP ${res.status}`);
}

async function upload(key, body) {
  const path = objectPath(key);
  const ext = key.split('.').pop().toLowerCase();
  const headers = signedHeaders('PUT', path, {
    'content-type': CONTENT_TYPES[ext] || 'application/octet-stream',
    'cache-control': CACHE_CONTROL,
  }, sha256(body));
  const res = await fetch(`https://${HOST}${path}`, { method: 'PUT', headers, body });
  if (!res.ok) throw new Error(`PUT ${key}: HTTP ${res.status} ${await res.text()}`);
}

async function readSource(key) {
  if (UPLOAD_DIR) {
    const p = join(UPLOAD_DIR, key);
    if (existsSync(p)) return { body: readFileSync(p), from: 'disk' };
  }
  if (SOURCE_ORIGIN) {
    const res = await fetch(`${SOURCE_ORIGIN}/uploads/${key}`, { redirect: 'manual' });
    // 302 = o sunucu zaten R2'ye yönlendiriyor; kaynak olarak kullanılamaz
    if (res.status === 200) return { body: Buffer.from(await res.arrayBuffer()), from: 'origin' };
  }
  return null;
}

const keys = collectKeys().filter((k) => KEY_RE.test(k));
if (LIST_ONLY) {
  keys.forEach((k) => console.log(k));
  console.error(`${keys.length} görsel referansı`);
  process.exit(0);
}

const ACCOUNT = env('R2_ACCOUNT_ID');
const ACCESS_KEY = env('R2_ACCESS_KEY_ID');
const SECRET_KEY = env('R2_SECRET_ACCESS_KEY');
const BUCKET = env('R2_BUCKET');
const HOST = `${ACCOUNT}.r2.cloudflarestorage.com`;

console.log(`${keys.length} görsel referansı bulundu. ${APPLY ? 'YÜKLENİYOR' : 'KURU ÇALIŞMA (yazmak için --apply)'}`);

const stats = { already: 0, uploaded: 0, wouldUpload: 0, missing: [] , failed: [] };
for (const key of keys) {
  try {
    if (await existsInBucket(key)) { stats.already++; continue; }
    const src = await readSource(key);
    if (!src) { stats.missing.push(key); continue; }
    if (APPLY) {
      await upload(key, src.body);
      stats.uploaded++;
      console.log(`  ↑ ${key} (${src.from}, ${src.body.length} B)`);
    } else {
      stats.wouldUpload++;
      console.log(`  · ${key} (${src.from}, ${src.body.length} B)`);
    }
  } catch (e) {
    stats.failed.push(`${key}: ${e.message}`);
  }
}

console.log(`\nKovada zaten var: ${stats.already}`);
console.log(APPLY ? `Yüklendi: ${stats.uploaded}` : `Yüklenecek: ${stats.wouldUpload}`);
console.log(`Kaynağı bulunamadı (kayıp): ${stats.missing.length}`);
stats.missing.forEach((k) => console.log(`  ✗ ${k}`));
if (stats.failed.length) {
  console.log(`Hata: ${stats.failed.length}`);
  stats.failed.forEach((f) => console.log(`  ! ${f}`));
  process.exit(1);
}
