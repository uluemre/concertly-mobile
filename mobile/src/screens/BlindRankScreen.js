import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Image, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function BlindRankScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // phase: search | loading | ranking | result
  const [phase, setPhase] = useState('search');
  const [query, setQuery] = useState('');
  const [artists, setArtists] = useState([]);
  const [searching, setSearching] = useState(false);

  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [slots, setSlots] = useState([]);
  const [playing, setPlaying] = useState(false);

  const soundRef = useRef(null);
  const searchTimerRef = useRef(null);

  const placedCount = slots.filter(Boolean).length;
  const currentTrack = tracks[placedCount] || null;

  const stopSound = useCallback(async () => {
    setPlaying(false);
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    return () => {
      clearTimeout(searchTimerRef.current);
      stopSound();
    };
  }, [stopSound]);

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

  // ── Başlat ──────────────────────────────────────────────────────────────
  const startRanking = async (selectedArtist) => {
    setPhase('loading');
    setArtist(selectedArtist);
    try {
      const res = await API.get(
        `/quiz/blind-rank?artistId=${selectedArtist.artistId}&artistName=${encodeURIComponent(selectedArtist.name)}`
      );
      setTracks(res.data.tracks);
      setSlots(new Array(res.data.tracks.length).fill(null));
      setPhase('ranking');
    } catch (err) {
      const msg = err.response?.status === 400 ? t('quiz_not_enough') : t('quiz_load_error');
      Alert.alert(t('error'), msg);
      setPhase('search');
    }
  };

  // ── Dinle / yerleştir ───────────────────────────────────────────────────
  const togglePreview = async () => {
    if (playing) { stopSound(); return; }
    if (!currentTrack?.previewUrl) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: currentTrack.previewUrl },
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) setPlaying(false);
      });
      soundRef.current = sound;
      setPlaying(true);
    } catch (e) {
      console.log('blind-rank play error:', e?.message);
      setPlaying(false);
    }
  };

  const placeInSlot = (index) => {
    if (slots[index] || !currentTrack) return;
    stopSound();
    const next = [...slots];
    next[index] = currentTrack;
    setSlots(next);
    if (next.filter(Boolean).length === tracks.length) {
      setPhase('result');
    }
  };

  const resetToSearch = () => {
    stopSound();
    setPhase('search');
    setArtists([]);
    setQuery('');
  };

  // ── RENDER: ARAMA ───────────────────────────────────────────────────────
  if (phase === 'search') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={colors.headerGradient} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('blind_title')}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('blind_subtitle')}</Text>

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
                onPress={() => startRanking(item)}
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
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {query.trim().length >= 2 ? t('quiz_no_artists') : t('quiz_search_hint')}
                </Text>
              </View>
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
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🏆</Text>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('quiz_loading')}</Text>
      </View>
    );
  }

  // ── RENDER: SIRALAMA ────────────────────────────────────────────────────
  if (phase === 'ranking') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.rankHeader}>
          <Text style={[styles.rankProgress, { color: colors.textSecondary }]}>
            {t('blind_song_progress', { current: placedCount + 1, total: tracks.length })} · {artist?.name}
          </Text>

          {/* Mevcut şarkı kartı */}
          <View style={[styles.currentCard, { backgroundColor: colors.card, borderColor: colors.primary + '60' }]}>
            {currentTrack?.coverUrl ? (
              <Image source={{ uri: currentTrack.coverUrl }} style={styles.currentCover} />
            ) : (
              <View style={[styles.currentCover, styles.coverFallback]}>
                <Text style={{ fontSize: 26 }}>🎵</Text>
              </View>
            )}
            <View style={styles.currentInfo}>
              <Text style={[styles.currentTitle, { color: colors.text }]} numberOfLines={2}>
                {currentTrack?.title}
              </Text>
              <TouchableOpacity onPress={togglePreview} activeOpacity={0.8}>
                <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.listenBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.listenBtnText}>
                    {playing ? t('blind_pause') : t('blind_listen')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.placeHint, { color: colors.textSecondary }]}>{t('blind_place_hint')}</Text>
        </LinearGradient>

        {/* Sıralama slotları */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 8 }}>
          {slots.map((slot, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => placeInSlot(i)}
              disabled={!!slot}
              activeOpacity={0.75}
              style={[
                styles.slot,
                slot
                  ? { backgroundColor: colors.card, borderColor: colors.border }
                  : { backgroundColor: colors.primary + '10', borderColor: colors.primary + '50', borderStyle: 'dashed' },
              ]}
            >
              <Text style={[styles.slotRank, { color: slot ? colors.textSecondary : colors.primary }]}>
                {i < 3 ? MEDALS[i] : `${i + 1}.`}
              </Text>
              {slot ? (
                <>
                  {slot.coverUrl ? (
                    <Image source={{ uri: slot.coverUrl }} style={styles.slotCover} />
                  ) : null}
                  <Text style={[styles.slotTitle, { color: colors.text }]} numberOfLines={1}>{slot.title}</Text>
                  <Text style={{ fontSize: 12 }}>🔒</Text>
                </>
              ) : (
                <Text style={[styles.slotEmpty, { color: colors.primary }]}>{t('blind_empty_slot')}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── RENDER: SONUÇ ───────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.resultHeader}>
          <Text style={styles.resultEmoji}>🏆</Text>
          <Text style={[styles.resultTitle, { color: colors.text }]}>{t('blind_result_title')}</Text>
          <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
            {t('blind_result_sub', { artist: artist?.name })}
          </Text>

          <View style={styles.resultBtns}>
            <TouchableOpacity onPress={() => startRanking(artist)} activeOpacity={0.85} style={{ flex: 1 }}>
              <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.resultBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.resultBtnText}>{t('blind_play_again')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={resetToSearch}
              activeOpacity={0.85}
              style={[styles.resultBtnAlt, { borderColor: colors.border }]}
            >
              <Text style={[styles.resultBtnAltText, { color: colors.textSecondary }]}>{t('blind_new_artist')}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={{ padding: 16, gap: 8 }}>
          {slots.map((slot, i) => (
            <View
              key={i}
              style={[
                styles.slot,
                { backgroundColor: colors.card, borderColor: i < 3 ? '#F5A62360' : colors.border },
              ]}
            >
              <Text style={[styles.slotRank, { color: colors.textSecondary }]}>
                {i < 3 ? MEDALS[i] : `${i + 1}.`}
              </Text>
              {slot?.coverUrl ? <Image source={{ uri: slot.coverUrl }} style={styles.slotCover} /> : null}
              <Text style={[styles.slotTitle, { color: colors.text }]} numberOfLines={1}>{slot?.title}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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

    // SIRALAMA
    rankHeader: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, gap: 12 },
    rankProgress: { fontSize: 13, fontWeight: '700' },
    currentCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      borderWidth: 1.5, borderRadius: 18, padding: 14,
    },
    currentCover: { width: 76, height: 76, borderRadius: 12 },
    coverFallback: { backgroundColor: '#7C3AED33', justifyContent: 'center', alignItems: 'center' },
    currentInfo: { flex: 1, gap: 10 },
    currentTitle: { fontSize: 17, fontWeight: '900' },
    listenBtn: { paddingVertical: 9, borderRadius: 10, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 18 },
    listenBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    placeHint: { fontSize: 12, fontWeight: '600', textAlign: 'center' },

    slot: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderWidth: 1.5, borderRadius: 14,
      paddingVertical: 11, paddingHorizontal: 14, minHeight: 52,
    },
    slotRank: { fontSize: 16, fontWeight: '800', width: 32 },
    slotCover: { width: 32, height: 32, borderRadius: 6 },
    slotTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
    slotEmpty: { flex: 1, fontSize: 13, fontWeight: '700' },

    // SONUÇ
    resultHeader: { paddingTop: 70, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' },
    resultEmoji: { fontSize: 50, marginBottom: 8 },
    resultTitle: { fontSize: 24, fontWeight: '900' },
    resultSub: { fontSize: 14, marginTop: 4 },
    resultBtns: { flexDirection: 'row', gap: 12, marginTop: 22, width: '100%' },
    resultBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    resultBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    resultBtnAlt: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
    resultBtnAltText: { fontSize: 14, fontWeight: '700' },
  });
}
