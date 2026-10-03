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

// Menü kartları (Keşfet ile aynı dil): düz kart, rengi ikon taşır. tint: tema rengi anahtarı
const GAME_DEFS = [
  {
    key: 'daily',
    icon: 'calendar',
    tint: 'accent',
    titleKey: 'menu_daily_song',
    subKey: 'menu_daily_song_sub',
    screen: 'DailySong',
  },
  {
    key: 'quiz',
    icon: 'mic',
    tint: 'primary',
    titleKey: 'menu_song_quiz',
    subKey: 'menu_song_quiz_sub',
    screen: 'SongQuiz',
  },
  {
    key: 'blind',
    icon: 'trophy',
    tint: 'secondary',
    titleKey: 'menu_blind_rank',
    subKey: 'menu_blind_rank_sub',
    screen: 'BlindRank',
  },
  {
    key: 'setlist',
    icon: 'list',
    tint: 'purple',
    titleKey: 'setlist_title',
    subKey: 'games_setlist_sub',
    screen: 'Events',
  },
];

export default function GamesScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [daily, setDaily] = useState(null); // { streak, finished, solved }

  useFocusEffect(useCallback(() => {
    API.get('/daily-song/today')
      .then(res => setDaily(res.data))
      .catch(() => {});
  }, []));

  const dailyBadge = () => {
    if (!daily) return null;
    if (daily.finished) {
      return daily.solved
        ? { text: t('games_daily_done'), color: '#00D4AA' }
        : { text: t('games_daily_missed'), color: '#E94560' };
    }
    return { text: t('games_daily_waiting'), color: '#F5A623' };
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
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('games_title')}</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('games_subtitle')}</Text>
          </View>
          {daily?.streak > 0 && (
            <View style={[styles.streakPill, { backgroundColor: '#F5A62322', borderColor: '#F5A62360' }]}>
              <Text style={styles.streakText}>{t('daily_streak', { count: daily.streak })}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.list}>
        {GAME_DEFS.map(game => {
          const badge = game.key === 'daily' ? dailyBadge() : null;
          return (
            <TouchableOpacity
              key={game.key}
              onPress={() => game.key === 'setlist'
                ? navigation.navigate('EventsPicker', { pickForSetlist: true })
                : navigation.navigate(game.screen)}
              activeOpacity={0.85}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`${t(game.titleKey)}, ${t(game.subKey)}${badge ? `, ${badge.text}` : ''}`}
            >
              <View style={styles.cardGrad}>
                <View style={[styles.cardIconWrap, { backgroundColor: (colors[game.tint] || colors.primary) + '22' }]}>
                  <Ionicons name={game.icon} size={24} color={colors[game.tint] || colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{t(game.titleKey)}</Text>
                  <Text style={styles.cardSub} numberOfLines={2}>{t(game.subKey)}</Text>
                  {badge && (
                    <View style={[styles.cardBadge, { backgroundColor: badge.color + '22' }]}>
                      <Text style={[styles.cardBadgeText, { color: badge.color }]}>{badge.text}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, gap: 10 },
    backText: { fontSize: 16, fontWeight: '600' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 26, fontWeight: '900' },
    headerSub: { fontSize: 13, marginTop: 4 },
    streakPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
    streakText: { color: '#F5A623', fontSize: 13, fontWeight: '800' },

    list: { padding: 16, gap: 12 },
    card: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    cardGrad: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
    cardIconWrap: {
      width: 54, height: 54, borderRadius: 27,
      justifyContent: 'center', alignItems: 'center',
    },
    cardInfo: { flex: 1, gap: 3 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    cardSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
    cardBadge: {
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 8, marginTop: 4,
    },
    cardBadgeText: { fontSize: 11, fontWeight: '800' },
  });
}
