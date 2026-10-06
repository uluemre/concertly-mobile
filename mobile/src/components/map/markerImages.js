// Harita işaretçileri için hazır PNG'ler (assets/map; üretici: scripts/generate-map-markers.py).
//
// Neden görüntü: react-native-maps özel React görünümlü işaretçileri yerel tarafta
// bitmap'e çeviriyor; kümeler her yakınlaştırmada değiştiği için yüzlerce işaretçi
// sürekli yeniden çiziliyor ve iOS'ta harita donuyordu. `image` ile verilen işaretçi
// hiç görünüm çizimi gerektirmez — en hızlı yol budur.
//
// Görüntüler 1x/@2x/@3x. Renk ya da aralık değişirse betikle yeniden üretilip buraya
// eklenmeli; require'lar statik olmak zorunda.

const PINS = {
  rock: require('../../../assets/map/pin-rock.png'),
  pop: require('../../../assets/map/pin-pop.png'),
  jazz: require('../../../assets/map/pin-jazz.png'),
  electronic: require('../../../assets/map/pin-electronic.png'),
  rap: require('../../../assets/map/pin-rap.png'),
};

const PINS_SELECTED = {
  rock: require('../../../assets/map/pin-rock-sel.png'),
  pop: require('../../../assets/map/pin-pop-sel.png'),
  jazz: require('../../../assets/map/pin-jazz-sel.png'),
  electronic: require('../../../assets/map/pin-electronic-sel.png'),
  rap: require('../../../assets/map/pin-rap-sel.png'),
};

// [alt sınır, görüntü] — büyükten küçüğe
const CLUSTERS = [
  [500, require('../../../assets/map/cluster-500.png')],
  [250, require('../../../assets/map/cluster-250.png')],
  [100, require('../../../assets/map/cluster-100.png')],
  [50, require('../../../assets/map/cluster-50.png')],
  [25, require('../../../assets/map/cluster-25.png')],
  [10, require('../../../assets/map/cluster-10.png')],
  [5, require('../../../assets/map/cluster-5.png')],
  [2, require('../../../assets/map/cluster-2.png')],
];

/** Tür adından renk anahtarı (MapScreen'deki GENRE_COLORS ile aynı eşleme). */
export function genreKey(genre) {
  // Sıra MapScreen.getMarkerColor ile aynı: "pop rock" ikisinde de rock rengi
  const g = (genre || '').toLowerCase();
  if (g.includes('rock')) return 'rock';
  if (g.includes('pop')) return 'pop';
  if (g.includes('jazz')) return 'jazz';
  if (g.includes('elektronik') || g.includes('electronic')) return 'electronic';
  if (g.includes('rap')) return 'rap';
  return 'rock';
}

export function pinImage(genre, selected) {
  const key = genreKey(genre);
  return (selected ? PINS_SELECTED : PINS)[key];
}

/** Kümedeki etkinlik sayısına göre "2+", "5+" … "500+" balonu. */
export function clusterImage(count) {
  for (const [min, image] of CLUSTERS) {
    if (count >= min) return image;
  }
  return CLUSTERS[CLUSTERS.length - 1][1];
}

/** Erişilebilirlik ve test için balonda yazan aralık. */
export function clusterLabel(count) {
  for (const [min] of CLUSTERS) {
    if (count >= min) return `${min}+`;
  }
  return '2+';
}
