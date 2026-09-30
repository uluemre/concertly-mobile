/**
 * Kullanıcı adı kuralı (N-21) — backend UsernameRules ile aynı.
 * 3-20 karakter; küçük harf, rakam, "_" ve "."; en az bir harf. Girdi kırpılıp küçük harfe çevrilir.
 */
const VALID = /^(?=.*[a-z])[a-z0-9_.]{3,20}$/;

export function normalizeUsername(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

export function isValidUsername(raw) {
  return VALID.test(normalizeUsername(raw));
}
