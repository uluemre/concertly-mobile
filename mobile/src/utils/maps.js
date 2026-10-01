import { Linking, Platform } from 'react-native';

// Mekanın haritada gösterilebilecek koordinatı; yoksa null (eski/eksik kayıtlarda boş gelir).
export function venueCoords(venue) {
  const lat = venue?.latitude;
  const lon = venue?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { latitude: lat, longitude: lon };
}

// Haritaya tıklanınca Apple / Google Maps (EventDetail'deki davranışla aynı)
export function openMapsAt(latitude, longitude, label) {
  const name = encodeURIComponent(label || 'Mekan');
  const url = Platform.select({
    ios: `maps:0,0?q=${name}@${latitude},${longitude}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${name})`,
  });
  const web = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  if (!url) { Linking.openURL(web); return; }
  Linking.canOpenURL(url).then(ok => Linking.openURL(ok ? url : web)).catch(() => Linking.openURL(web));
}

// Koordinat yoksa ad + adres + şehir ile arama (Google Maps web her platformda açılır)
export function openMapsSearch(text) {
  if (!text) return;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`);
}
