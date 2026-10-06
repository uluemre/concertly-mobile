import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { hapticLight } from '../utils/haptics';

const STREAK_COLOR = '#F5A623';

// 2x2 renkli oyun kutuları; rengi kutunun kendisi taşır
const GAME_TILES = [
  { key: 'quiz', icon: 'help-circle-outline', color: '#7C3AED', titleKey: 'games_quiz_title', subKey: 'games_quiz_sub', screen: 'SongQuiz' },
  { key: 'blind', icon: 'list', color: '#E94560', titleKey: 'games_blind_title', subKey: 'games_blind_sub', screen: 'BlindRank' },
  { key: 'bingo', icon: 'grid-outline', color: '#F57C00', titleKey: 'menu_bingo', subKey: 'games_bingo_sub', screen: 'ConcertBingo' },
  { key: 'setlist', icon: 'musical-notes', color: '#00A88A', titleKey: 'games_setlist_title', subKey: 'games_setlist_tile_sub', screen: 'EventsPicker', params: { pickForSetlist: true } },
];

export default function GamesScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [daily, setDaily] = useState(null); // { streak, finished, solved, week }

  useFocusEffect(useCallback(() => {
    API.get('/daily-song/today')
      .then(res => setDaily(res.data))
      .catch(() => {});
  }, []));

  const weekdays = t('games_weekdays').split(',');
  const week = Array.isArray(daily?.week) ? daily.week : [];
  const todayIndex = (new Date().getDay() + 6) % 7; // Pazartesi = 0
  const streak = daily?.streak ?? 0;
  const streakText = streak > 0 ? t('games_streak_line', { count: streak }) : t('games_streak_none');

  const dailyStatus = () => {
    if (!daily) return null;
    if (daily.finished) return daily.solved ? t('games_daily_done') : t('games_daily_missed');
    return t('games_daily_waiting');
  };
  const status = dailyStatus();

  const open = (screen, params) => {
    hapticLight();
    navigation.navigate(screen, params);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} accessibilityRole="button">
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('games_title')}</Text>
      </View>

      <View style={styles.body}>
        <TouchableOpacity
          onPress={() => open('DailySong')}
          activeOpacity={0.85}
          style={styles.dailyCard}
          accessibilityRole="button"
          accessibilityLabel={`${t('menu_daily_song')}, ${streakText}${status ? `, ${status}` : ''}`}
        >
          <View style={styles.dailyTop}>
            <View style={styles.flameWrap}>
              <Ionicons name="flame" size={26} color={STREAK_COLOR} />
            </View>
            <View style={styles.dailyInfo}>
              <Text style={styles.dailyTitle}>{t('menu_daily_song')}</Text>
              <Text style={styles.dailySub} numberOfLines={1}>{streakText}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>

          <View style={styles.weekRow}>
            {weekdays.map((label, i) => {
              const done = !!week[i];
              const isToday = i === todayIndex;
              return (
                <View key={label} style={styles.dayCol}>
                  <View style={[styles.dayRing, isToday && styles.dayRingToday]}>
                    <View style={[styles.dayDot, done && styles.dayDotDone]} />
                  </View>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
                </View>
              );
            })}
          </View>

          {status && <Text style={styles.dailyStatus} numberOfLines={1}>{status}</Text>}
        </TouchableOpacity>

        <View style={styles.grid}>
          {GAME_TILES.map(game => (
            <TouchableOpacity
              key={game.key}
              onPress={() => open(game.screen, game.params)}
              activeOpacity={0.85}
              style={[styles.tile, { backgroundColor: game.color }]}
              accessibilityRole="button"
              accessibilityLabel={`${t(game.titleKey)}, ${t(game.subKey)}`}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={game.icon} size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.tileTitle} numberOfLines={1}>{t(game.titleKey)}</Text>
                <Text style={styles.tileSub} numberOfLines={2}>{t(game.subKey)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20, gap: 10 },
    backText: { fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 28, fontWeight: '900' },

    body: { paddingHorizontal: 16, gap: 14 },

    dailyCard: {
      borderRadius: 20, padding: 18, gap: 16,
      backgroundColor: colors.card, borderWidth: 1, borderColor: STREAK_COLOR + '55',
    },
    dailyTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    flameWrap: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: STREAK_COLOR + '22', justifyContent: 'center', alignItems: 'center',
    },
    dailyInfo: { flex: 1, gap: 2 },
    dailyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
    dailySub: { fontSize: 13, fontWeight: '700', color: STREAK_COLOR },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayCol: { alignItems: 'center', gap: 6 },
    dayRing: {
      width: 30, height: 30, borderRadius: 15,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    dayRingToday: { borderColor: STREAK_COLOR },
    dayDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.border },
    dayDotDone: { backgroundColor: STREAK_COLOR },
    dayLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    dayLabelToday: { color: STREAK_COLOR, fontWeight: '800' },
    dailyStatus: { fontSize: 12, color: colors.textSecondary },

    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
    tile: {
      width: '48.5%', minHeight: 150, borderRadius: 20, padding: 16,
      justifyContent: 'space-between',
    },
    tileIcon: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center',
    },
    tileTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
    tileSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 3, lineHeight: 16 },
  });
}
