import React, { memo, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getGenreGradient } from '../utils/gradients';
import { eventImageCandidates, initialsOf } from '../utils/eventImage';

/**
 * Etkinlik görseli: etkinlik ve sanatçı görsellerini sırayla dener, hiçbiri
 * yüklenemezse boş/kırık kutu yerine türe göre renklenmiş bir yer tutucu
 * (sanatçının baş harfleri) gösterir.
 *
 * Kullanan listelerde `key` olarak etkinlik id'si verilmeli; böylece geri
 * dönüştürülen satırda önceki etkinliğin hata durumu taşınmaz.
 */
function EventImage({ item, style, genericImages, initialsSize = 26, showInitials = true, children }) {
  const candidates = useMemo(() => eventImageCandidates(item, genericImages), [item, genericImages]);
  const [attempt, setAttempt] = useState(0);
  const uri = candidates[attempt];

  return (
    <View style={[styles.frame, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          onError={() => setAttempt(a => a + 1)}
        />
      ) : (
        <LinearGradient
          colors={getGenreGradient(item?.genre)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.placeholder]}
        >
          <Ionicons name="musical-notes" size={initialsSize * 0.7} color="rgba(255,255,255,0.35)" style={styles.note} />
          {showInitials ? (
            <Text style={[styles.initials, { fontSize: initialsSize }]} numberOfLines={1}>
              {initialsOf(item?.artistName || item?.name)}
            </Text>
          ) : null}
        </LinearGradient>
      )}
      {children}
    </View>
  );
}

export default memo(EventImage);

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#1E1E2E' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  note: { position: 'absolute', top: 8, right: 8 },
  initials: { color: '#fff', fontWeight: '900', letterSpacing: 0.5 },
});
