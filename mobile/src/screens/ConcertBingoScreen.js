import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const GAP = 6;
const PADDING = 12;
const SQUARE_SIZE = (SCREEN_W - PADDING * 2 - GAP * 4) / 5;

const SQUARE_KEYS = [
  'encore', 'crowd_surf', 'phone_sea', 'first_album_song', 'biggest_hit',
  'new_album_song', 'wore_sunglasses', 'sang_with_crowd', 'threw_water', 'forgot_lyrics',
  'drum_solo', 'said_last_song', 'confetti', 'stage_dive', 'said_city_name',
  'changed_outfit', 'acoustic_version', 'remix_mashup', 'announced_new_song', 'vip_went_crazy',
  'artist_cried', 'show_started_late', 'mosh_pit', 'crowd_chant', 'guitar_solo',
];

const SQUARE_EMOJIS = [
  '🎸','🌊','📱','💿','⭐',
  '🆕','🕶️','🎤','💧','😅',
  '🥁','🎺','🎊','🤸','🏙️',
  '👗','🪕','🎛️','📢','🔥',
  '😭','⏰','💪','📣','🎶',
];

// Her sütun kendi gradyanını taşır (5 sütun → 5 renk)
const COL_GRADIENTS = [
  ['#E94560', '#C2185B'],
  ['#7C3AED', '#5B21B6'],
  ['#1976D2', '#0097A7'],
  ['#00897B', '#43A047'],
  ['#F57C00', '#F5A623'],
];

export default function ConcertBingoScreen({ navigation, route }) {
  const { eventId, eventName } = route?.params ?? {};
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const bingoAnim = useRef(new Animated.Value(0)).current;
  const bingoScale = useRef(new Animated.Value(0.8)).current;

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    API.post('/bingo/card', { eventId: eventId ?? null, eventName: eventName ?? null })
      .then(res => { if (active) { setCard(res.data); if (res.data.hasBingo) showBingo(); } })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId, eventName]));

  const showBingo = () => {
    Animated.parallel([
      Animated.spring(bingoScale, { toValue: 1, useNativeDriver: true, tension: 180, friction: 6 }),
      Animated.timing(bingoAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const toggle = async (index) => {
    if (!card || toggling !== null) return;
    setToggling(index);
    try {
      const res = await API.put(`/bingo/card/${card.id}/toggle`, { index });
      const updated = res.data;
      if (!card.hasBingo && updated.hasBingo) showBingo();
      setCard(updated);
    } catch {}
    setToggling(null);
  };

  const marked = useMemo(() => new Set(card?.markedIndices ?? []), [card]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 48 }}>

      {/* HEADER */}
      <LinearGradient colors={['#0D0D1A', '#1a0a2e', '#0D0D1A']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('bingo_title')}</Text>
        <Text style={styles.headerSub}>
          {eventName ?? t('bingo_generic')}
        </Text>

        {/* İlerleme bar */}
        <View style={styles.progressWrap}>
          <View style={[styles.progressBg, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <LinearGradient
              colors={['#00D4AA', '#7C3AED']}
              style={[styles.progressFill, { width: `${(marked.size / 25) * 100}%` }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.progressText}>{marked.size}/25</Text>
        </View>
      </LinearGradient>

      {/* BINGO BANNER */}
      {card?.hasBingo && (
        <Animated.View style={[styles.bingoBannerWrap, { opacity: bingoAnim, transform: [{ scale: bingoScale }] }]}>
          <LinearGradient
            colors={['#F5A623', '#E94560', '#7C3AED']}
            style={styles.bingoBanner}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={styles.bingoEmoji}>🎉</Text>
            <Text style={styles.bingoText}>{t('bingo_bingo')}</Text>
            <Text style={styles.bingoSub}>Konser Pasaportu'na rozet eklendi!</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* HİNT */}
      {!card?.hasBingo && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('bingo_tap_hint')}</Text>
      )}

      {/* GRID */}
      <View style={styles.grid}>
        {SQUARE_KEYS.map((key, index) => {
          const isMarked = marked.has(index);
          const isLoading = toggling === index;
          const col = index % 5;
          const gradient = COL_GRADIENTS[col];

          return (
            <TouchableOpacity
              key={key}
              onPress={() => toggle(index)}
              activeOpacity={0.8}
              style={styles.squareWrap}
            >
              {isMarked ? (
                <LinearGradient colors={gradient} style={styles.square} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.squareCheckmark}>✓</Text>
                  <Text style={styles.squareEmoji}>{SQUARE_EMOJIS[index]}</Text>
                  <Text style={styles.squareTextMarked} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {t(`bingo_sq_${key}`)}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={[styles.square, styles.squareUnmarked, { borderColor: gradient[0] + '55' }]}>
                  {isLoading ? (
                    <ActivityIndicator color={gradient[0]} size="small" />
                  ) : (
                    <>
                      <Text style={[styles.squareEmoji, { opacity: 0.5 }]}>{SQUARE_EMOJIS[index]}</Text>
                      <Text style={[styles.squareTextUnmarked, { color: colors.textSecondary }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {t(`bingo_sq_${key}`)}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* RENK AÇIKLAMASI */}
      <View style={styles.legend}>
        {COL_GRADIENTS.map((g, i) => (
          <LinearGradient key={i} colors={g} style={styles.legendDot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        ))}
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>= Sütun rengi</Text>
      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, gap: 6 },
    backText: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
    headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },

    progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    progressBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },

    bingoBannerWrap: { marginHorizontal: 12, marginTop: 14, borderRadius: 18, overflow: 'hidden' },
    bingoBanner: { paddingVertical: 20, alignItems: 'center', gap: 4 },
    bingoEmoji: { fontSize: 36 },
    bingoText: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 3 },
    bingoSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

    hint: { textAlign: 'center', fontSize: 12, marginTop: 12, marginBottom: 4 },

    grid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: PADDING,
      gap: GAP,
      marginTop: 12,
    },
    squareWrap: {
      width: SQUARE_SIZE,
      height: SQUARE_SIZE * 1.15,
      borderRadius: 12,
      overflow: 'hidden',
    },
    square: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingVertical: 6,
      gap: 3,
      borderRadius: 12,
    },
    squareUnmarked: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
    },
    squareCheckmark: {
      position: 'absolute', top: 5, right: 7,
      fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.9)',
    },
    squareEmoji: { fontSize: 20 },
    squareTextMarked: {
      fontSize: 10, fontWeight: '800', color: '#fff',
      textAlign: 'center', lineHeight: 13,
    },
    squareTextUnmarked: {
      fontSize: 10, fontWeight: '600',
      textAlign: 'center', lineHeight: 13,
    },

    legend: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 6, marginTop: 16,
    },
    legendDot: { width: 14, height: 14, borderRadius: 7 },
    legendText: { fontSize: 11 },
  });
}
