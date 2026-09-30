/**
 * Topluluk türü eşlemesi (A2) — backend CommunityTypes ile aynı.
 * Kayıtlarda aynı tür farklı yazılabiliyor ("Şehir"/"Sehir", "Diğer"/"Diger");
 * ekranda ham değer yerine dile göre çeviri gösterilir.
 */
const ALIASES = {
  rock: ['rock'],
  festival: ['festival'],
  electronic: ['elektronik', 'electronic'],
  city: ['şehir', 'sehir', 'city'],
  jazz: ['caz', 'jazz'],
  pop: ['pop'],
  rap: ['rap'],
  other: ['diğer', 'diger', 'other'],
};

// toLowerCase (dile bağlı değil): "Şehir" → "şehir", "Diğer" → "diğer"
const key = (raw) => String(raw ?? '').trim().toLowerCase();

/** Bilinen türün kodu ('city', 'other'…); bilinmiyorsa null. */
export function communityTypeCode(raw) {
  const k = key(raw);
  if (!k) return null;
  for (const [code, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(k)) return code;
  }
  return null;
}

/** Ekranda gösterilecek tür adı; bilinmeyen tür ham haliyle gösterilir. */
export function communityTypeLabel(raw, t) {
  const code = communityTypeCode(raw);
  return code ? t(`community_type_${code}`) : String(raw ?? '');
}
