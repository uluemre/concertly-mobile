import React from 'react';
import { Image, Platform } from 'react-native';
import { Marker } from 'react-native-maps';

// Hazır PNG'li işaretçi (bkz. markerImages).
//
// Android: `image` prop'u — görünüm çizimi yok, en hızlı yol.
// iOS: react-native-maps'in `image` yükleyicisi `[RCTBridge currentBridge]` kullanıyor;
// yeni mimaride (köprüsüz, Expo SDK 57) bu nil döndüğü için görüntü hiç yüklenmiyor ve
// işaretçiler görünmüyordu. iOS'ta aynı PNG işaretçinin içine düz bir Image olarak konur.
// Apple Haritalar alt görünümü doğrudan gösterir (bitmap'e çevirmez); kümeleme sayesinde
// ekrandaki işaretçi sayısı az olduğundan akıcılık korunur. Görüntü merkezde durur.
export default function ImageMarker({ source, ...props }) {
  if (Platform.OS !== 'ios') {
    return <Marker image={source} {...props} />;
  }
  const { width, height } = Image.resolveAssetSource(source);
  return (
    <Marker {...props}>
      <Image source={source} style={{ width, height }} fadeDuration={0} />
    </Marker>
  );
}
