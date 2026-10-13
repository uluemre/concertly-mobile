import { parseEventDate } from '../../utils/time';

// Fotoğraf üstündeki metin ve katmanlar temadan bağımsız koyu kalır (açık temada da okunur)
export const onPhoto = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.82)',
  glass: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.22)',
  badge: 'rgba(6,6,18,0.72)',
  shade: 'rgba(6,6,18,0.92)',
  fade: 'rgba(6,6,18,0.2)',
};

export function splitGenres(value) {
  return value ? value.split(',').map(g => g.trim()).filter(Boolean) : [];
}

export function scoreOf(person) {
  return person?.compatibility ?? person?.genreMatchScore ?? 0;
}

export function displayName(person) {
  if (!person) return '';
  const name = person.fullName || `@${person.username}`;
  return person.age ? `${name}, ${person.age}` : name;
}

export function shortDate(iso, locale) {
  return parseEventDate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function longDate(iso, locale) {
  return parseEventDate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function eventTitle(ev) {
  return ev?.artistName || ev?.name || '';
}

// "Neden uyumlusunuz" maddeleri (kart ve profil detayı aynı listeyi gösterir)
export function reasonsFor(card, t) {
  const reasons = [];
  if (card.sharedArtists?.length) reasons.push({ icon: 'mic', text: card.sharedArtists.join(', '), strong: true });
  if (card.pastConcertsTogether > 0) reasons.push({ icon: 'ticket', text: t('buddy_reason_together', { count: card.pastConcertsTogether }), strong: true });
  if (card.sharedGenres?.length) reasons.push({ icon: 'musical-notes', text: card.sharedGenres.join(', ') });
  if (card.sameCity) reasons.push({ icon: 'location', text: t('buddy_reason_city') });
  if (reasons.length === 0) reasons.push({ icon: 'sparkles', text: t('buddy_reason_new') });
  return reasons;
}
