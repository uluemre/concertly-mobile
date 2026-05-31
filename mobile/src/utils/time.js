export function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return {
    day: d.toLocaleDateString('tr-TR', { day: 'numeric' }),
    month: d.toLocaleDateString('tr-TR', { month: 'short' }),
  };
}
