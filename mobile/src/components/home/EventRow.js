import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { getGenreGradient } from '../../utils/gradients';
import { formatDateShort } from '../../utils/time';

const ACCENT_COLORS = ['#E94560', '#7C3AED', '#F5A623', '#00D4AA', '#FF6B6B', '#4ECDC4'];

function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default React.memo(function EventRow({ item, index, onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [thumbError, setThumbError] = React.useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0, delay: index * 60, tension: 60, friction: 9, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, delay: index * 60, duration: 300, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const { day, month } = formatDateShort(item.eventDate);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <TouchableOpacity style={styles.row} onPress={() => onPress(item)} activeOpacity={0.82}>
        <View style={[styles.dateBox, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
          <Text style={[styles.dateDay, { color: accent }]}>{day}</Text>
          <Text style={[styles.dateMon, { color: accent }]}>{month}</Text>
        </View>
        <View style={styles.thumb}>
          {(item.imageUrl || item.artistImageUrl) && !thumbError ? (
            <Image
              source={{ uri: item.imageUrl || item.artistImageUrl }}
              style={styles.thumbImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              onError={() => setThumbError(true)}
            />
          ) : (
            <LinearGradient
              colors={getGenreGradient(item.genre)}
              style={[styles.thumbImg, { alignItems: 'center', justifyContent: 'center' }]}
            >
              <Text style={styles.thumbInitials}>{getInitials(item.artistName || item.name)}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {item.artistName && <Text style={styles.artist} numberOfLines={1}>🎤 {item.artistName}</Text>}
          {item.venueCity && <Text style={styles.venue} numberOfLines={1}>📍 {item.venueCity}</Text>}
        </View>
        <View style={[styles.arrow, { backgroundColor: accent + '18' }]}>
          <Text style={{ color: accent, fontSize: 16, fontWeight: '700' }}>›</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

function createStyles(colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: 16, padding: 12,
      marginBottom: 10, borderWidth: 1, borderColor: colors.border, gap: 12,
    },
    dateBox: {
      width: 46, height: 52, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    },
    dateDay: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
    dateMon: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    thumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' },
    thumbImg: { width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    thumbInitials: { fontSize: 18, fontWeight: '900', color: 'rgba(255,255,255,0.9)' },
    info: { flex: 1 },
    name: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 3 },
    artist: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
    venue: { fontSize: 12, color: colors.textSecondary },
    arrow: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  });
}
