import React, { useEffect, useRef, useState, useMemo } from 'react';
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

export default React.memo(function FeaturedCard({ item, index, cardWidth, cardHeight, onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, cardWidth, cardHeight), [colors, cardWidth, cardHeight]);
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1, delay: index * 80, tension: 55, friction: 8, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, delay: index * 80, duration: 350, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const { day, month } = formatDateShort(item.eventDate);

  return (
    <Animated.View style={[styles.outer, { opacity, transform: [{ scale }] }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={() => onPress(item)}>
        <View style={styles.card}>
          {(item.imageUrl || item.artistImageUrl) && !imgError ? (
            <Image
              source={{ uri: item.imageUrl || item.artistImageUrl }}
              style={styles.bg}
              contentFit="cover"
              cachePolicy="memory-disk"
              onError={() => setImgError(true)}
            />
          ) : null}
          {(!(item.imageUrl || item.artistImageUrl) || imgError) && (
            <LinearGradient
              colors={getGenreGradient(item.genre)}
              style={[styles.bg, styles.bgPlaceholder]}
            >
              <Text style={styles.initials}>{getInitials(item.artistName || item.name)}</Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(4,4,16,0.65)', 'rgba(4,4,16,0.97)']}
            style={styles.scrim}
          />
          <View style={[styles.dateBadge, { backgroundColor: accent }]}>
            <Text style={styles.dateBadgeDay}>{day}</Text>
            <Text style={styles.dateBadgeMon}>{month}</Text>
          </View>
          {item.genre && (
            <View style={styles.genreTag}>
              <Text style={styles.genreTagText}>{item.genre}</Text>
            </View>
          )}
          <View style={styles.content}>
            {item.artistName && (
              <Text style={styles.artist} numberOfLines={1}>🎤 {item.artistName}</Text>
            )}
            <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
            <View style={styles.meta}>
              {item.venueCity && (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>📍 {item.venueCity}</Text>
                </View>
              )}
              <View style={[styles.pill, { borderColor: accent + '60', backgroundColor: accent + '18' }]}>
                <Text style={[styles.pillText, { color: accent }]}>
                  {item.isApproved ? '✓ Onaylı' : '⏳ Bekliyor'}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.accentLine, { backgroundColor: accent }]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

function createStyles(colors, cardWidth, cardHeight) {
  return StyleSheet.create({
    outer: { width: cardWidth },
    card: {
      width: cardWidth, height: cardHeight, borderRadius: 22,
      overflow: 'hidden', backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
    },
    bg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    bgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    initials: {
      fontSize: 72, fontWeight: '900', color: 'rgba(255,255,255,0.25)', letterSpacing: -2,
    },
    scrim: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    dateBadge: {
      position: 'absolute', top: 14, left: 14,
      width: 42, height: 48, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    dateBadgeDay: { fontSize: 18, fontWeight: '900', color: '#fff', lineHeight: 20 },
    dateBadgeMon: { fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'uppercase', opacity: 0.85 },
    genreTag: {
      position: 'absolute', top: 14, right: 14,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    genreTagText: { color: '#fff', fontSize: 11, fontWeight: '600', opacity: 0.8 },
    content: { position: 'absolute', bottom: 14, left: 14, right: 14 },
    artist: { fontSize: 12, color: '#fff', opacity: 0.7, marginBottom: 4, fontWeight: '600' },
    title: { fontSize: 18, fontWeight: '900', color: '#fff', lineHeight: 22, marginBottom: 10 },
    meta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    pill: {
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    pillText: { fontSize: 11, color: '#fff', fontWeight: '600', opacity: 0.8 },
    accentLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },
  });
}
