import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../../theme';
import { getGenreGradient } from '../../utils/gradients';
import { displayName, eventTitle, onPhoto, scoreOf, shortDate, splitGenres } from './buddyUtils';

// Deste kartı: tam fotoğraf, sağ üstte uyum rozeti, altta isim, türler, sanatçılar ve
// birlikte gidilebilecek konserler. Detaylar karta dokununca açılan profilde.
function BuddyCard({ card, activeEvent, t, locale, onMenu, onScore, isBack = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const score = scoreOf(card);
  const genres = splitGenres(card.favoriteGenres);
  const sharedGenres = new Set((card.sharedGenres || []).map(g => g.toLowerCase()));
  const shared = card.sharedEvents || [];
  // Filtrelenen konser başa alınır
  const sharedSorted = activeEvent
    ? [...shared].sort((a, b) => (b.id === activeEvent) - (a.id === activeEvent))
    : shared;
  const artists = card.sharedArtists?.length ? card.sharedArtists : (card.topArtists || []);

  return (
    <View style={styles.card}>
      {card.profileImageUrl ? (
        <Image source={{ uri: card.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <LinearGradient colors={getGenreGradient(genres[0])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.fallback]}>
          <Text style={styles.initial}>{card.username?.charAt(0).toUpperCase()}</Text>
        </LinearGradient>
      )}
      <LinearGradient colors={[`${colors.secondary}2E`, 'transparent']} style={styles.topGlow} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', onPhoto.fade, onPhoto.shade]}
        locations={[0.35, 0.58, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {!isBack && onMenu ? (
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={onMenu}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('mod_options_title')}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={onPhoto.text} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.score}
        onPress={onScore}
        disabled={isBack || !onScore}
        activeOpacity={0.8}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${t('buddy_compat_label')} %${score}`}
        accessibilityHint={t('buddy_compat_explain_title')}
      >
        <Text style={styles.scoreValue}>%{score}</Text>
        <Text style={styles.scoreLabel}>{t('buddy_compat_label')}</Text>
      </TouchableOpacity>

      <View style={styles.body} pointerEvents="none">
        <Text style={styles.name} numberOfLines={1}>{displayName(card)}</Text>
        <View style={styles.metaRow}>
          {card.city ? (
            <View style={styles.meta}>
              <Ionicons name="location-sharp" size={14} color={colors.primary} />
              <Text style={styles.metaText}>{card.city}</Text>
            </View>
          ) : null}
          {card.concertCount > 0 ? (
            <View style={styles.meta}>
              <Ionicons name="ticket" size={13} color={onPhoto.muted} />
              <Text style={styles.metaText}>{t('buddy_concert_count', { count: card.concertCount })}</Text>
            </View>
          ) : null}
        </View>

        {genres.length > 0 ? (
          <View style={styles.chips}>
            {genres.slice(0, 3).map(g => (
              <View key={g} style={[styles.chip, sharedGenres.has(g.toLowerCase()) && styles.chipShared]}>
                <Text style={styles.chipText}>{g}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {artists.length > 0 ? (
          <Text style={styles.artists} numberOfLines={1}>{artists.slice(0, 3).join('  ·  ')}</Text>
        ) : null}

        {sharedSorted.length > 0 ? (
          <View style={styles.sharedBox}>
            {sharedSorted.slice(0, 2).map(ev => (
              <View key={ev.id} style={styles.sharedRow}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <Text style={styles.sharedText} numberOfLines={1}>
                  {`${eventTitle(ev)} · ${shortDate(ev.eventDate, locale)}`}
                </Text>
              </View>
            ))}
            {sharedSorted.length > 2 ? (
              <Text style={styles.sharedMore}>{t('buddy_more_concerts', { count: sharedSorted.length - 2 })}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(BuddyCard);

function createStyles(colors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    fallback: { alignItems: 'center', justifyContent: 'center' },
    initial: { fontFamily: fonts.heading, fontSize: 120, color: 'rgba(255,255,255,0.35)' },
    topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
    menuBtn: {
      position: 'absolute',
      top: 16,
      left: 16,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: onPhoto.badge,
      alignItems: 'center',
      justifyContent: 'center',
    },
    score: {
      position: 'absolute',
      top: 16,
      right: 16,
      backgroundColor: onPhoto.badge,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: `${colors.primary}73`,
    },
    scoreValue: { color: onPhoto.text, fontFamily: fonts.heading, fontSize: 20 },
    scoreLabel: { color: colors.primary, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
    body: { position: 'absolute', left: 18, right: 18, bottom: 20, gap: 8 },
    name: { color: onPhoto.text, fontFamily: fonts.heading, fontSize: 30 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: onPhoto.muted, fontSize: 14 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    chip: {
      backgroundColor: onPhoto.glass,
      borderColor: onPhoto.glassBorder,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    chipShared: { backgroundColor: `${colors.purple}66` },
    chipText: { color: onPhoto.text, fontSize: 12, fontWeight: '600' },
    artists: { color: onPhoto.muted, fontSize: 13 },
    sharedBox: {
      marginTop: 6,
      backgroundColor: `${colors.primary}29`,
      borderRadius: 18,
      padding: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: `${colors.primary}47`,
    },
    sharedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    sharedText: { color: onPhoto.text, fontSize: 12, fontWeight: '600', flex: 1 },
    sharedMore: { color: onPhoto.muted, fontSize: 11, marginLeft: 15 },
  });
}
