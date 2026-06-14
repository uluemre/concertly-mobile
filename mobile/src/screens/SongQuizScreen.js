import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Image, Animated, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

const QUESTION_TIME = 10000; // soru başına 10 sn
const FEEDBACK_DELAY = 900;  // doğru/yanlış rengini gösterme süresi

const OPTION_GRADIENTS = [
  ['#E94560', '#C81D4E'],
  ['#7C3AED', '#5B21B6'],
  ['#3B82F6', '#1D4ED8'],
];

export default function SongQuizScreen({ navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // phase: search | loading | playing | result
  const [phase, setPhase] = useState('search');
  const [query, setQuery] = useState('');
  const [artists, setArtists] = useState([]);
  const [searching, setSearching] = useState(false);

  const [artist, setArtist] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [feedback, setFeedback] = useState(null); // { picked, correctIndex }
  const [remaining, setRemaining] = useState(QUESTION_TIME);
  const [leaderboard, setLeaderboard] = useState(null);

  const soundRef = useRef(null);
  const timerRef = useRef(null);
  const questionStartRef = useRef(0);
  const searchTimerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Temizlik ────────────────────────────────────────────────────────────
  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(searchTimerRef.current);
      stopSound();
    };
  }, [stopSound]);

  // Çalma sırasında nabız animasyonu
  useEffect(() => {
    if (phase !== 'playing' || feedback) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, qIndex, feedback]);

  // ── Sanatçı arama ───────────────────────────────────────────────────────
  const handleQueryChange = (text) => {
    setQuery(text);
    clearTimeout(searchTimerRef.current);
    if (text.trim().length < 2) { setArtists([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await API.get(`/quiz/artists?q=${encodeURIComponent(text.trim())}`);
        setArtists(res.data);
      } catch {} finally {
        setSearching(false);
      }
    }, 400);
  };

  // ── Quiz başlat ─────────────────────────────────────────────────────────
  const startQuiz = async (selectedArtist) => {
    setPhase('loading');
    setArtist(selectedArtist);
    try {
      const res = await API.get(
        `/quiz/questions?artistId=${selectedArtist.artistId}&artistName=${encodeURIComponent(selectedArtist.name)}`
      );
      setQuestions(res.data.questions);
      setQIndex(0);
      setScore(0);
      setAnswers([]);
      setFeedback(null);
      setPhase('playing');
      playQuestion(res.data.questions, 0);
    } catch (err) {
      const msg = err.response?.status === 400 ? t('quiz_not_enough') : t('quiz_load_error');
      Alert.alert(t('error'), msg);
      setPhase('search');
    }
  };

  // ── Soru çal ────────────────────────────────────────────────────────────
  const playQuestion = async (qs, idx) => {
    await stopSound();
    const q = qs[idx];
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: q.previewUrl },
        { shouldPlay: true, positionMillis: q.startMs }
      );
      soundRef.current = sound;
    } catch (e) {
      console.log('quiz play error:', e?.message);
    }

    questionStartRef.current = Date.now();
    setRemaining(QUESTION_TIME);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const left = QUESTION_TIME - (Date.now() - questionStartRef.current);
      if (left <= 0) {
        handleAnswer(-1, qs, idx); // süre doldu
      } else {
        setRemaining(left);
      }
    }, 100);
  };

  // ── Cevap ───────────────────────────────────────────────────────────────
  const handleAnswer = (picked, qs = questions, idx = qIndex) => {
    clearInterval(timerRef.current);
    stopSound();

    const q = qs[idx];
    const elapsed = Math.min(QUESTION_TIME, Date.now() - questionStartRef.current);
    const isCorrect = picked === q.correctIndex;
    const points = isCorrect
      ? 100 + Math.round(100 * (QUESTION_TIME - elapsed) / QUESTION_TIME)
      : 0;

    if (isCorrect) setScore(prev => prev + points);
    setAnswers(prev => [...prev, { correct: isCorrect, elapsed, points,
      title: q.options[q.correctIndex] }]);
    setFeedback({ picked, correctIndex: q.correctIndex });

    setTimeout(() => {
      setFeedback(null);
      if (idx + 1 < qs.length) {
        setQIndex(idx + 1);
        playQuestion(qs, idx + 1);
      } else {
        finishQuiz();
      }
    }, FEEDBACK_DELAY);
  };

  // ── Bitiş ───────────────────────────────────────────────────────────────
  const finishQuiz = async () => {
    setPhase('result');
    // state güncellemeleri asenkron — final değerleri answers üzerinden değil,
    // sonuç ekranı render'ında hesaplanır; skor kaydı bir tick sonra yapılır
  };

  // Sonuç fazına geçince skoru kaydet + leaderboard çek
  useEffect(() => {
    if (phase !== 'result' || !artist || answers.length === 0) return;
    const totalScore = answers.reduce((s, a) => s + a.points, 0);
    const correctCount = answers.filter(a => a.correct).length;
    const durationMs = answers.reduce((s, a) => s + a.elapsed, 0);

    (async () => {
      try {
        await API.post('/quiz/score', {
          artistName: artist.name,
          score: totalScore,
          correctCount,
          totalQuestions: answers.length,
          durationMs,
        });
      } catch {}
      try {
        const res = await API.get(`/quiz/leaderboard?artist=${encodeURIComponent(artist.name)}`);
        setLeaderboard(res.data);
      } catch {}
    })();
  }, [phase]);

  const resetToSearch = () => {
    stopSound();
    setPhase('search');
    setLeaderboard(null);
    setArtists([]);
    setQuery('');
  };

  // ── RENDER: SANATÇI ARAMA ───────────────────────────────────────────────
  if (phase === 'search') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={colors.headerGradient} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('quiz_title')}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('quiz_subtitle')}</Text>

          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>⌕</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('quiz_search_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
            />
          </View>
        </LinearGradient>

        {searching ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={artists}
            keyExtractor={item => String(item.artistId)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.artistRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => startQuiz(item)}
                activeOpacity={0.8}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.artistImg} />
                ) : (
                  <View style={[styles.artistImg, styles.artistImgFallback]}>
                    <Text style={{ fontSize: 22 }}>🎤</Text>
                  </View>
                )}
                <Text style={[styles.artistName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.artistChevron, { color: colors.textSecondary }]}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              query.trim().length >= 2 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🎤</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('quiz_no_artists')}</Text>
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🎧</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('quiz_search_hint')}</Text>
                </View>
              )
            }
          />
        )}
      </View>
    );
  }

  // ── RENDER: YÜKLENİYOR ──────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🎧</Text>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('quiz_loading')}</Text>
      </View>
    );
  }

  // ── RENDER: OYUN ────────────────────────────────────────────────────────
  if (phase === 'playing') {
    const q = questions[qIndex];
    const progress = remaining / QUESTION_TIME;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.quizHeader}>
          <View style={styles.quizTopRow}>
            <Text style={[styles.quizProgress, { color: colors.textSecondary }]}>
              {t('quiz_question', { current: qIndex + 1, total: questions.length })}
            </Text>
            <View style={[styles.scorePill, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '60' }]}>
              <Text style={[styles.scorePillText, { color: colors.primary }]}>⭐ {score}</Text>
            </View>
          </View>

          {/* Süre çubuğu */}
          <View style={[styles.timeBarTrack, { backgroundColor: colors.cardAlt }]}>
            <View style={[
              styles.timeBarFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: progress > 0.5 ? '#00D4AA' : progress > 0.25 ? '#F5A623' : '#E94560',
              },
            ]} />
          </View>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {(remaining / 1000).toFixed(1)} sn
          </Text>
        </LinearGradient>

        {/* Çalan şarkı görseli */}
        <View style={styles.discArea}>
          <Animated.View style={[styles.disc, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.discGrad}>
              <Text style={styles.discEmoji}>🎵</Text>
            </LinearGradient>
          </Animated.View>
          <Text style={[styles.whichSong, { color: colors.text }]}>{t('quiz_which_song')}</Text>
        </View>

        {/* Şıklar */}
        <View style={styles.options}>
          {q.options.map((opt, i) => {
            let bg = null;
            if (feedback) {
              if (i === feedback.correctIndex) bg = '#00D4AA';
              else if (i === feedback.picked) bg = '#E94560';
            }
            return (
              <TouchableOpacity
                key={i}
                onPress={() => !feedback && handleAnswer(i)}
                disabled={!!feedback}
                activeOpacity={0.85}
                style={styles.optionWrap}
              >
                {bg ? (
                  <View style={[styles.option, { backgroundColor: bg }]}>
                    <Text style={styles.optionText}>
                      {i === feedback.correctIndex ? '✓ ' : i === feedback.picked ? '✗ ' : ''}{opt}
                    </Text>
                  </View>
                ) : (
                  <LinearGradient
                    colors={OPTION_GRADIENTS[i % OPTION_GRADIENTS.length]}
                    style={styles.option}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // ── RENDER: SONUÇ ───────────────────────────────────────────────────────
  const totalScore = answers.reduce((s, a) => s + a.points, 0);
  const correctCount = answers.filter(a => a.correct).length;
  const avgSec = answers.length
    ? (answers.reduce((s, a) => s + a.elapsed, 0) / answers.length / 1000).toFixed(1)
    : '0';
  const ratio = answers.length ? correctCount / answers.length : 0;
  const rankMsg = ratio >= 0.8 ? t('quiz_rank_perfect') : ratio >= 0.5 ? t('quiz_rank_good') : t('quiz_rank_bad');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={leaderboard?.top || []}
        keyExtractor={(item, i) => `${item.userId}-${i}`}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.resultHeader}>
              <Text style={styles.resultEmoji}>🎉</Text>
              <Text style={[styles.resultTitle, { color: colors.text }]}>{t('quiz_result_title')}</Text>
              <Text style={[styles.resultArtist, { color: colors.textSecondary }]}>{artist?.name}</Text>

              <Text style={[styles.resultScore, { color: colors.primary }]}>{totalScore}</Text>
              <Text style={[styles.resultRank, { color: colors.text }]}>{rankMsg}</Text>

              <View style={styles.resultStats}>
                <View style={styles.resultStat}>
                  <Text style={[styles.resultStatNum, { color: colors.text }]}>
                    {t('quiz_result_correct', { correct: correctCount, total: answers.length })}
                  </Text>
                </View>
                <View style={[styles.resultStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.resultStat}>
                  <Text style={[styles.resultStatNum, { color: colors.text }]}>
                    {t('quiz_result_avg', { sec: avgSec })}
                  </Text>
                </View>
              </View>

              <View style={styles.resultBtns}>
                <TouchableOpacity onPress={() => startQuiz(artist)} activeOpacity={0.85} style={{ flex: 1 }}>
                  <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.resultBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.resultBtnText}>{t('quiz_play_again')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={resetToSearch}
                  activeOpacity={0.85}
                  style={[styles.resultBtnAlt, { borderColor: colors.border }]}
                >
                  <Text style={[styles.resultBtnAltText, { color: colors.textSecondary }]}>{t('quiz_new_artist')}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <Text style={[styles.lbTitle, { color: colors.textSecondary }]}>{t('quiz_leaderboard')}</Text>
            {leaderboard === null && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
            )}
            {leaderboard?.top?.length === 0 && (
              <Text style={[styles.lbEmpty, { color: colors.textSecondary }]}>{t('quiz_no_scores')}</Text>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const isMe = item.userId === session.userId;
          return (
            <View style={[
              styles.lbRow,
              { backgroundColor: colors.card, borderColor: isMe ? colors.primary : colors.border },
            ]}>
              <Text style={[styles.lbRank, { color: index < 3 ? '#F5A623' : colors.textSecondary }]}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
              </Text>
              <Text style={[styles.lbName, { color: isMe ? colors.primary : colors.text }]} numberOfLines={1}>
                @{item.username}{isMe ? t('quiz_you') : ''}
              </Text>
              <Text style={[styles.lbCorrect, { color: colors.textSecondary }]}>
                {item.correctCount}/{item.totalQuestions}
              </Text>
              <Text style={[styles.lbScore, { color: colors.text }]}>{item.score}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 14, fontSize: 14 },

    header: { paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20, gap: 8 },
    backText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    headerTitle: { fontSize: 26, fontWeight: '900' },
    headerSub: { fontSize: 13 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginTop: 6,
    },
    searchInput: { flex: 1, fontSize: 14 },

    artistRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10,
    },
    artistImg: { width: 52, height: 52, borderRadius: 26 },
    artistImgFallback: { backgroundColor: '#7C3AED33', justifyContent: 'center', alignItems: 'center' },
    artistName: { flex: 1, fontSize: 16, fontWeight: '700' },
    artistChevron: { fontSize: 24, fontWeight: '300' },

    empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

    // OYUN
    quizHeader: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, gap: 10 },
    quizTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    quizProgress: { fontSize: 14, fontWeight: '700' },
    scorePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
    scorePillText: { fontSize: 14, fontWeight: '800' },
    timeBarTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
    timeBarFill: { height: 8, borderRadius: 4 },
    timeText: { fontSize: 12, fontWeight: '600', alignSelf: 'flex-end' },

    discArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
    disc: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', elevation: 8,
      shadowColor: '#E94560', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 },
    discGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    discEmoji: { fontSize: 56 },
    whichSong: { fontSize: 17, fontWeight: '800' },

    options: { padding: 20, gap: 12, paddingBottom: 36 },
    optionWrap: { borderRadius: 16, overflow: 'hidden' },
    option: { paddingVertical: 18, paddingHorizontal: 20, borderRadius: 16, alignItems: 'center' },
    optionText: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },

    // SONUÇ
    resultHeader: { paddingTop: 70, paddingBottom: 26, paddingHorizontal: 24, alignItems: 'center' },
    resultEmoji: { fontSize: 52, marginBottom: 8 },
    resultTitle: { fontSize: 24, fontWeight: '900' },
    resultArtist: { fontSize: 14, marginTop: 4 },
    resultScore: { fontSize: 56, fontWeight: '900', marginTop: 14, letterSpacing: -1 },
    resultRank: { fontSize: 16, fontWeight: '700', marginTop: 4 },
    resultStats: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18 },
    resultStat: {},
    resultStatNum: { fontSize: 14, fontWeight: '700' },
    resultStatDivider: { width: 1, height: 16 },
    resultBtns: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
    resultBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    resultBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    resultBtnAlt: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
    resultBtnAltText: { fontSize: 14, fontWeight: '700' },

    lbTitle: {
      fontSize: 12, fontWeight: '800', letterSpacing: 1.2,
      marginHorizontal: 20, marginTop: 24, marginBottom: 12,
    },
    lbEmpty: { textAlign: 'center', marginTop: 16, fontSize: 14 },
    lbRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginHorizontal: 16, marginBottom: 8,
      borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16,
    },
    lbRank: { fontSize: 16, fontWeight: '800', width: 34 },
    lbName: { flex: 1, fontSize: 14, fontWeight: '700' },
    lbCorrect: { fontSize: 12, fontWeight: '600' },
    lbScore: { fontSize: 16, fontWeight: '900', minWidth: 50, textAlign: 'right' },
  });
}
