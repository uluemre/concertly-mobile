import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Image, Animated, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

export default function DailySongScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [game, setGame] = useState(null);       // /daily-song/today cevabı
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [wrongGuesses, setWrongGuesses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [playError, setPlayError] = useState(false);

  const soundRef = useRef(null);
  const stopTimerRef = useRef(null);
  const searchTimerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const stopSound = useCallback(async () => {
    clearTimeout(stopTimerRef.current);
    setPlaying(false);
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    }).catch(() => {});
    fetchToday();
    return () => {
      clearTimeout(searchTimerRef.current);
      stopSound();
    };
  }, []);

  useEffect(() => {
    if (!playing) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 450, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [playing]);

  const fetchToday = async () => {
    try {
      const res = await API.get('/daily-song/today');
      setGame(res.data);
    } catch {
      setGame(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Dinleme: kilidi açık süre kadar çal ─────────────────────────────────
  const allowedMs = game
    ? (game.finished ? 30000 : game.snippetMs[Math.min(game.attemptsUsed, game.snippetMs.length - 1)])
    : 0;

  const playSnippet = async () => {
    if (playing) { stopSound(); return; }
    if (!game?.previewUrl) { setPlayError(true); return; }
    setPlayError(false);

    // Durmayı gerçek çalma pozisyonuna bağla — buffer gecikmesi snippet'i yemesin.
    const onStatus = (status) => {
      if (!status.isLoaded) {
        if (status.error) {
          console.log('daily-song status error:', status.error);
          stopSound();
          setPlayError(true);
        }
        return;
      }
      if (status.didJustFinish || status.positionMillis >= allowedMs) {
        stopSound();
      }
    };

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: game.previewUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        onStatus
      );
      soundRef.current = sound;
      setPlaying(true);
      // Güvenlik ağı: pozisyon güncellemesi hiç gelmezse yine de dur.
      stopTimerRef.current = setTimeout(stopSound, allowedMs + 4000);
    } catch (e) {
      console.log('daily-song play error:', e?.message);
      setPlaying(false);
      setPlayError(true);
    }
  };

  // ── Tahmin arama (otomatik tamamlama) ───────────────────────────────────
  const handleQueryChange = (text) => {
    setQuery(text);
    clearTimeout(searchTimerRef.current);
    if (text.trim().length < 2) { setSuggestions([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await API.get(`/daily-song/search?q=${encodeURIComponent(text.trim())}`);
        setSuggestions(res.data);
      } catch {}
    }, 350);
  };

  // ── Tahmin / pas ────────────────────────────────────────────────────────
  const submitGuess = async (title, skip = false) => {
    if (submitting) return;
    setSubmitting(true);
    stopSound();
    try {
      const res = await API.post('/daily-song/guess', skip ? { skip: true } : { guess: title });
      const r = res.data;
      if (!r.correct && !skip) {
        setWrongGuesses(prev => [...prev, title]);
      }
      if (skip) {
        setWrongGuesses(prev => [...prev, t('daily_skipped')]);
      }
      setGame(prev => ({
        ...prev,
        attemptsUsed: r.attemptsUsed,
        solved: r.correct,
        finished: r.finished,
        answer: r.answer ?? prev.answer,
        solvedAttempt: r.solvedAttempt ?? prev.solvedAttempt,
        streak: r.streak ?? prev.streak,
        stats: r.stats ?? prev.stats,
      }));
      setQuery('');
      setSuggestions([]);
    } catch {} finally {
      setSubmitting(false);
    }
  };

  // ── RENDER ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>😞</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{t('daily_load_error')}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); fetchToday(); }} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.retryBtnText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const attempts = Array.from({ length: game.maxAttempts }, (_, i) => {
    if (game.solved && i === game.solvedAttempt - 1) return 'solved';
    if (i < game.attemptsUsed && !(game.solved && i >= game.solvedAttempt - 1)) return 'wrong';
    return 'pending';
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* HEADER */}
      <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('daily_title')}</Text>
            <Text style={[styles.headerDay, { color: colors.textSecondary }]}>
              {t('daily_day', { day: game.dayNumber })}
            </Text>
          </View>
          {game.streak > 0 && (
            <View style={[styles.streakPill, { backgroundColor: '#F5A62322', borderColor: '#F5A62360' }]}>
              <Text style={styles.streakText}>{t('daily_streak', { count: game.streak })}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* DENEME GÖSTERGESİ */}
      <View style={styles.attemptRow}>
        {attempts.map((s, i) => (
          <View
            key={i}
            style={[
              styles.attemptBox,
              { borderColor: colors.border, backgroundColor: colors.card },
              s === 'wrong' && { backgroundColor: '#E9456030', borderColor: '#E94560' },
              s === 'solved' && { backgroundColor: '#00D4AA30', borderColor: '#00D4AA' },
            ]}
          >
            <Text style={styles.attemptBoxText}>
              {s === 'wrong' ? '✗' : s === 'solved' ? '✓' : ''}
            </Text>
          </View>
        ))}
      </View>

      {!game.finished ? (
        <>
          {/* DİNLE */}
          <View style={styles.playArea}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity onPress={playSnippet} activeOpacity={0.85}>
                <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.playBtn}>
                  <Text style={styles.playBtnIcon}>{playing ? '⏸' : '▶'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Text style={[styles.playHint, { color: colors.textSecondary }]}>
              {playing ? t('daily_listening') : t('daily_listen', { sec: allowedMs / 1000 })}
            </Text>
            {playError && (
              <Text style={[styles.playHint, { color: '#E94560' }]}>{t('daily_play_error')}</Text>
            )}
          </View>

          {/* TAHMİN */}
          <View style={styles.guessArea}>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>⌕</Text>
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('daily_guess_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={handleQueryChange}
              />
            </View>

            {suggestions.map((sug, i) => (
              <TouchableOpacity
                key={`${sug.title}-${i}`}
                style={[styles.suggestion, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => submitGuess(sug.title)}
                activeOpacity={0.8}
              >
                <Text style={[styles.suggestionTitle, { color: colors.text }]} numberOfLines={1}>
                  {sug.title}
                </Text>
                <Text style={[styles.suggestionArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                  {sug.artist}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Yanlış tahminler */}
            {wrongGuesses.map((w, i) => (
              <View key={i} style={[styles.wrongRow, { backgroundColor: '#E9456015', borderColor: '#E9456040' }]}>
                <Text style={[styles.wrongText, { color: '#E94560' }]} numberOfLines={1}>❌ {w}</Text>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => submitGuess(null, true)}
              style={[styles.skipBtn, { borderColor: colors.border }]}
              disabled={submitting}
            >
              <Text style={[styles.skipBtnText, { color: colors.textSecondary }]}>{t('daily_skip')}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* SONUÇ */
        <View style={styles.resultArea}>
          <Text style={styles.resultEmoji}>{game.solved ? '🎉' : '😢'}</Text>
          <Text style={[styles.resultTitle, { color: colors.text }]}>
            {game.solved ? t('daily_solved_title') : t('daily_failed_title')}
          </Text>
          {game.solved && (
            <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
              {t('daily_solved_in', { n: game.solvedAttempt })}
            </Text>
          )}

          {/* Cevap kartı */}
          <View style={[styles.answerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {game.answer?.coverUrl ? (
              <Image source={{ uri: game.answer.coverUrl }} style={styles.answerCover} />
            ) : (
              <View style={[styles.answerCover, styles.answerCoverFallback]}>
                <Text style={{ fontSize: 30 }}>🎵</Text>
              </View>
            )}
            <View style={styles.answerInfo}>
              <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>{t('daily_answer_was')}</Text>
              <Text style={[styles.answerTitle, { color: colors.text }]} numberOfLines={2}>{game.answer?.title}</Text>
              <Text style={[styles.answerArtist, { color: colors.textSecondary }]} numberOfLines={1}>{game.answer?.artist}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={playSnippet} activeOpacity={0.85} style={{ width: '100%' }}>
            <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.fullPlayBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.fullPlayBtnText}>{playing ? '⏸ ' + t('daily_listening') : t('daily_play_full')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {game.stats && (
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>
              {t('daily_stats', { players: game.stats.players, percent: game.stats.solvedPercent })}
            </Text>
          )}
          <Text style={[styles.tomorrowText, { color: colors.textSecondary }]}>{t('daily_tomorrow')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 15, marginBottom: 20 },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    retryBtnText: { color: '#fff', fontWeight: '700' },

    header: { paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20, gap: 10 },
    backText: { fontSize: 16, fontWeight: '600' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: '900' },
    headerDay: { fontSize: 13, marginTop: 2 },
    streakPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
    streakText: { color: '#F5A623', fontSize: 13, fontWeight: '800' },

    attemptRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 22 },
    attemptBox: {
      width: 44, height: 44, borderRadius: 12, borderWidth: 1.5,
      justifyContent: 'center', alignItems: 'center',
    },
    attemptBoxText: { fontSize: 18, fontWeight: '900', color: '#fff' },

    playArea: { alignItems: 'center', marginTop: 30, gap: 14 },
    playBtn: {
      width: 110, height: 110, borderRadius: 55,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: '#E94560', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
    },
    playBtnIcon: { fontSize: 40, color: '#fff' },
    playHint: { fontSize: 14, fontWeight: '600' },

    guessArea: { paddingHorizontal: 20, marginTop: 26, gap: 10 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    },
    searchInput: { flex: 1, fontSize: 15 },
    suggestion: {
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    },
    suggestionTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
    suggestionArtist: { fontSize: 12 },
    wrongRow: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
    wrongText: { fontSize: 13, fontWeight: '700' },
    skipBtn: {
      borderWidth: 1, borderRadius: 12, paddingVertical: 12,
      alignItems: 'center', marginTop: 4,
    },
    skipBtnText: { fontSize: 14, fontWeight: '700' },

    resultArea: { alignItems: 'center', paddingHorizontal: 24, marginTop: 26, gap: 14 },
    resultEmoji: { fontSize: 54 },
    resultTitle: { fontSize: 24, fontWeight: '900' },
    resultSub: { fontSize: 14, marginTop: -6 },
    answerCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      borderWidth: 1, borderRadius: 18, padding: 14, width: '100%',
    },
    answerCover: { width: 72, height: 72, borderRadius: 12 },
    answerCoverFallback: { backgroundColor: '#7C3AED33', justifyContent: 'center', alignItems: 'center' },
    answerInfo: { flex: 1 },
    answerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    answerTitle: { fontSize: 17, fontWeight: '900', marginTop: 3 },
    answerArtist: { fontSize: 13, marginTop: 2 },
    fullPlayBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    fullPlayBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    statsText: { fontSize: 13, fontWeight: '600' },
    tomorrowText: { fontSize: 13 },
  });
}
