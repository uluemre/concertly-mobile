import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

const GAME_DEFS = [
  {
    key: 'daily',
    emoji: '📅',
    titleKey: 'menu_daily_song',
    subKey: 'menu_daily_song_sub',
    gradient: ['#00D4AA', '#F5A623'],
    screen: 'DailySong',
  },
  {
    key: 'quiz',
    emoji: '🎤',
    titleKey: 'menu_song_quiz',
    subKey: 'menu_song_quiz_sub',
    gradient: ['#7C3AED', '#EC4899'],
    screen: 'SongQuiz',
  },
  {
    key: 'blind',
    emoji: '🏆',
    titleKey: 'menu_blind_rank',
    subKey: 'menu_blind_rank_sub',
    gradient: ['#F5A623', '#7C3AED'],
    screen: 'BlindRank',
  },
  {
    key: 'setlist',
    emoji: '🎯',
    titleKey: 'setlist_title',
    subKey: 'games_setlist_sub',
    gradient: ['#E94560', '#3B82F6'],
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
      <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
      </LinearGradient>

      <View style={styles.list}>
        {GAME_DEFS.map(game => {
          const badge = game.key === 'daily' ? dailyBadge() : null;
          return (
            <TouchableOpacity
              key={game.key}
              onPress={() => navigation.navigate(game.screen)}
              activeOpacity={0.85}
              style={styles.card}
            >
              <LinearGradient
                colors={game.gradient}
                style={styles.cardGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <View style={styles.cardIconWrap}>
                  <Text style={styles.cardIcon}>{game.emoji}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{t(game.titleKey)}</Text>
                  <Text style={styles.cardSub} numberOfLines={2}>{t(game.subKey)}</Text>
                  {badge && (
                    <View style={[styles.cardBadge, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
                      <Text style={[styles.cardBadgeText, { color: '#fff' }]}>{badge.text}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardArrow}>›</Text>
              </LinearGradient>
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
    card: { borderRadius: 18, overflow: 'hidden' },
    cardGrad: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
    cardIconWrap: {
      width: 54, height: 54, borderRadius: 27,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center', alignItems: 'center',
    },
    cardIcon: { fontSize: 26 },
    cardInfo: { flex: 1, gap: 3 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
    cardSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 16 },
    cardBadge: {
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 8, marginTop: 4,
    },
    cardBadgeText: { fontSize: 11, fontWeight: '800' },
    cardArrow: { color: 'rgba(255,255,255,0.8)', fontSize: 26, fontWeight: '300' },
  });
}
