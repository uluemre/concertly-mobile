export const GENRE_GRADIENTS = {
  'Rock':       ['#E94560', '#7C1AED'],
  'Pop':        ['#FF6B9D', '#C44569'],
  'Rap':        ['#2C3E50', '#F39C12'],
  'Elektronik': ['#00D4AA', '#0066CC'],
  'Jazz':       ['#F5A623', '#8B4513'],
  'Klasik':     ['#4A0E8F', '#1a237e'],
  'Indie':      ['#00BCD4', '#2E7D32'],
  'R&B':        ['#9C27B0', '#E91E63'],
  'Folk':       ['#8BC34A', '#5D4037'],
  'Reggae':     ['#43A047', '#FDD835'],
  'Arabesk':    ['#8B0000', '#DAA520'],
};

export function getGenreGradient(genre) {
  if (!genre) return ['#E94560', '#7C3AED'];
  const key = Object.keys(GENRE_GRADIENTS).find(k =>
    genre.toLowerCase().includes(k.toLowerCase())
  );
  return GENRE_GRADIENTS[key] || ['#E94560', '#7C3AED'];
}
