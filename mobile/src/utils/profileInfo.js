/**
 * Ad soyad ve doğum tarihi kuralları — backend ProfileRules ile aynı.
 * Doğum tarihi "GG.AA.YYYY" yazılır, sunucuya "YYYY-MM-DD" gider.
 * Concertly 18 yaş ve üzeri içindir.
 */
export const MIN_AGE = 18;
const NAME_MAX = 60;

export function normalizeFullName(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

// Harf: büyük/küçük biçimi olan karakter (Hermes'te \p{L} desteğine güvenmeden)
const isLetter = (c) => c.toLowerCase() !== c.toUpperCase();
const isMark = (c) => /[̀-ͯ]/.test(c);

export function isValidFullName(raw) {
  const name = normalizeFullName(raw);
  const chars = Array.from(name);
  return name.length >= 2 && name.length <= NAME_MAX
    && chars.some(isLetter)
    && chars.every(c => isLetter(c) || isMark(c) || " .'-".includes(c));
}

/** Yazarken noktaları kendisi koyar: "01021999" → "01.02.1999". */
export function maskBirthInput(raw) {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

function today() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

function ageOf(y, m, d, now = today()) {
  let age = now.y - y;
  if (now.m < m || (now.m === m && now.d < d)) age -= 1;
  return age;
}

/**
 * "GG.AA.YYYY" → { iso, age } ya da { error } (çeviri anahtarı).
 * Eksik giriş için error: 'reg_birth_incomplete'.
 */
export function parseBirthDate(input) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(input ?? ''));
  if (!m) return { error: 'reg_birth_incomplete' };
  const d = Number(m[1]); const mo = Number(m[2]); const y = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  const real = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
  const now = today();
  const future = y > now.y || (y === now.y && (mo > now.m || (mo === now.m && d > now.d)));
  if (!real || y < 1900 || future) return { error: 'reg_birth_invalid' };
  const age = ageOf(y, mo, d, now);
  if (age < MIN_AGE) return { error: 'reg_underage', age };
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return { iso, age };
}

/** Sunucudan gelen "YYYY-MM-DD" → "GG.AA.YYYY". */
export function isoToBirthInput(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** Sunucunun ad/doğum tarihi hata kodları → çeviri anahtarı (bilinmiyorsa null). */
export function profileErrorKey(code) {
  switch (code) {
    case 'FULL_NAME_INVALID': return 'reg_name_invalid';
    case 'BIRTH_DATE_INVALID': return 'reg_birth_invalid';
    case 'UNDERAGE': return 'reg_underage';
    case 'BIRTH_DATE_LOCKED': return 'complete_birth_locked';
    default: return null;
  }
}
