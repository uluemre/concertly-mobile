import { Linking } from 'react-native';

// Admin organizatör ekranlarının ortak yardımcıları

export function orgTypeKey(type) {
  if (type === 'VENUE') return 'org_type_venue';
  if (type === 'ARTIST_MANAGER') return 'org_type_manager';
  return 'org_type_organizer';
}

/** Hesap yaşı: gün sayısı ve okunur etiket ("3 gün", "5 ay", "2 yıl") */
export function accountAge(iso) {
  const created = iso ? new Date(iso) : null;
  const days = created && !Number.isNaN(created.getTime())
    ? Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000))
    : 0;
  return {
    days,
    label: (t) => {
      if (days < 31) return t('adm_org_age_days', { count: days });
      if (days < 365) return t('adm_org_age_months', { count: Math.floor(days / 30) });
      return t('adm_org_age_years', { count: Math.floor(days / 365) });
    },
  };
}

/** Başvurudaki web sitesini aç (şema yoksa https eklenir) */
export function openWebsite(url) {
  if (!url) return;
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  Linking.openURL(u).catch(() => {});
}

/** "@hesap", "hesap" ya da tam adres → Instagram profili */
export function openInstagram(handle) {
  if (!handle) return;
  const h = handle.trim();
  if (/^https?:\/\//i.test(h)) {
    Linking.openURL(h).catch(() => {});
    return;
  }
  const name = h.replace(/^@/, '').replace(/^instagram\.com\//i, '').replace(/\/$/, '');
  Linking.openURL(`https://instagram.com/${encodeURIComponent(name)}`).catch(() => {});
}
