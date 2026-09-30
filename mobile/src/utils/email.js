/**
 * E-posta kuralı (N-22) — backend EmailRules ile aynı.
 * Girdi kırpılıp küçük harfe çevrilir; "@" öncesi/sonrası boşluksuz, alan adında nokta, en fazla 254 karakter.
 */
const VALID = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

export function isValidEmail(raw) {
  const email = normalizeEmail(raw);
  return email.length <= 254 && VALID.test(email);
}
