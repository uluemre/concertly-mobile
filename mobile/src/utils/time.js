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

export function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - parseEventDate(dateStr).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  return parseEventDate(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function formatDateShort(dateStr) {
  const d = parseEventDate(dateStr);
  return {
    day: d.toLocaleDateString('tr-TR', { day: 'numeric' }),
    month: d.toLocaleDateString('tr-TR', { month: 'short' }),
  };
}
