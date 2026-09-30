// Parse a backend timestamp that has NO timezone offset (Spring `LocalDateTime`,
// e.g. "2026-06-25T20:00:00") into a Date built from its wall-clock components.
//
// We deliberately avoid `new Date(str)` for these: JS engines — and Hermes in
// particular — interpret offset-less ISO strings inconsistently (as UTC on some
// engines, device-local on others), which shifts concert times by hours and
// makes the "past event" filter wrong near midnight. Building the Date from the
// explicit parts renders the venue's local wall-clock time exactly, on any
// device, regardless of the phone's timezone. Drop-in replacement for
// `new Date(eventDate)`.
export function parseEventDate(value) {
  if (value instanceof Date) return value;
  if (value != null) {
    const m = String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
    );
    if (m) {
      const [, y, mo, d, h, mi, s] = m;
      return new Date(+y, +mo - 1, +d, +(h || 0), +(mi || 0), +(s || 0));
    }
  }
  // Fallback: let the engine try (handles odd formats / null).
  return new Date(value);
}

// Uygulama diline göre tarih yerel ayarı (N-35). Dil verilmezse Türkçe:
// dili iletmeyen eski çağrılar bugünkü gibi çalışır.
export function dateLocale(lang = 'tr') {
  return lang === 'en' ? 'en-GB' : 'tr-TR';
}

// Göreli zaman kısaltmaları (N-35)
const RELATIVE_UNITS = {
  tr: { now: 'az önce', justNow: 'şimdi', min: 'dk', hour: 'sa', day: 'g', week: 'h' },
  en: { now: 'now', justNow: 'now', min: 'm', hour: 'h', day: 'd', week: 'w' },
};

function relativeUnits(lang) {
  return RELATIVE_UNITS[lang === 'en' ? 'en' : 'tr'];
}

export function formatTimeAgo(dateStr, lang = 'tr') {
  if (!dateStr) return '';
  const u = relativeUnits(lang);
  const diff = (Date.now() - parseEventDate(dateStr).getTime()) / 1000;
  if (diff < 60) return u.now;
  if (diff < 3600) return `${Math.floor(diff / 60)}${u.min}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${u.hour}`;
  return parseEventDate(dateStr).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short' });
}

// Topluluk gönderileri için gün/hafta da kısaltılan göreli zaman ("3g", "2h" / "3d", "2w")
export function formatRelativeShort(dateStr, lang = 'tr') {
  if (!dateStr) return '';
  const u = relativeUnits(lang);
  const diffMin = Math.floor((Date.now() - parseEventDate(dateStr).getTime()) / 60000);
  if (diffMin < 1) return u.justNow; // topluluk ekranı eskiden beri "şimdi" der
  if (diffMin < 60) return `${diffMin}${u.min}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}${u.hour}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}${u.day}`;
  return `${Math.floor(diffDay / 7)}${u.week}`;
}

export function formatDateShort(dateStr, lang = 'tr') {
  const d = parseEventDate(dateStr);
  const locale = dateLocale(lang);
  return {
    day: d.toLocaleDateString(locale, { day: 'numeric' }),
    month: d.toLocaleDateString(locale, { month: 'short' }),
  };
}
