import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function SetlistPredictionScreen({ navigation, route }) {
  const { eventId } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // mode: loading | error | unsupported | predict | confirm | board
  const [mode, setMode] = useState('loading');
  const [state, setState] = useState(null);       // GET /setlist/{id} cevabı
  const [selected, setSelected] = useState([]);   // seçili şarkı adları
  const [board, setBoard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await API.get(`/setlist/${eventId}`);
      const s = res.data;
      setState(s);
      if (!s.eventPassed) {
        setSelected(s.myPrediction || []);
        setMode('predict');
      } else if (s.myConfirmation) {
        openBoard();
      } else {
        setSelected([]);
        setMode('confirm');
      }
    } catch (err) {
      if (__DEV__) console.log('Setlist hata:', err.message, '| status:', err.response?.status, '| eventId:', eventId);
      // 400 → sanatçı Deezer'da yok / şarkısı az: kalıcı kısıt, tekrar denemenin anlamı yok
      setMode(err.response?.status === 400 ? 'unsupported' : 'error');
    }
  }, [eventId]);

  useEffect(() => { fetchState(); }, [fetchState]);

  const openBoard = async () => {
    setMode('loading');
    try {
      const res = await API.get(`/setlist/${eventId}/leaderboard`);
      setBoard(res.data);
      setMode('board');
    } catch {
      setMode('error');
    }
  };

  const toggle = (title) => {
    setSelected(prev => {
      if (prev.includes(title)) return prev.filter(x => x !== title);
      if (mode === 'predict' && prev.length >= (state?.maxPrediction ?? 10)) return prev;
      return [...prev, title];
    });
  };

  const savePrediction = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await API.post(`/setlist/${eventId}/prediction`, { titles: selected });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
      setState(prev => ({ ...prev, myPrediction: selected }));
    } catch {
      Alert.alert(t('error'), t('setlist_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const submitConfirmation = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await API.post(`/setlist/${eventId}/confirm`, { titles: selected });
      setState(prev => ({ ...prev, myConfirmation: selected }));
      openBoard();
    } catch {
      Alert.alert(t('error'), t('setlist_save_error'));
    } finally {
      setSaving(false);
    }
  };

  // ── ORTAK PARÇALAR ──────────────────────────────────────────────────────
  const renderHeader = (subtitle) => (
    <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{t('setlist_title')}</Text>
      <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{subtitle}</Text>
    </LinearGradient>
  );

  const renderCandidates = () => (
    <View style={styles.chipWrap}>
      {state.candidates.map(c => {
        const isOn = selected.includes(c.title);
        return (
          <TouchableOpacity
            key={c.title}
            onPress={() => toggle(c.title)}
            activeOpacity={0.8}
            style={[
              styles.chip,
              { backgroundColor: colors.card, borderColor: colors.border },
              isOn && { backgroundColor: colors.primary + '22', borderColor: colors.primary },
            ]}
          >
            {c.coverUrl ? <Image source={{ uri: c.coverUrl }} style={styles.chipCover} /> : null}
            <Text
              style={[styles.chipText, { color: isOn ? colors.primary : colors.text }]}
              numberOfLines={1}
            >
              {c.title}
            </Text>
            {isOn && <Text style={[styles.chipCheck, { color: colors.primary }]}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── RENDER ──────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (mode === 'unsupported') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🎭</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{t('setlist_unsupported')}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.retryBtnText}>{t('back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'error') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🎯</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{t('setlist_load_error')}</Text>
        <TouchableOpacity
          onPress={() => { setMode('loading'); fetchState(); }}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.retryBtnText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── TAHMİN MODU (konser öncesi) ─────────────────────────────────────────
  if (mode === 'predict') {
    const canSave = selected.length >= state.minPrediction && selected.length <= state.maxPrediction;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {renderHeader(t('setlist_subtitle', { artist: state.artistName }))}

          <View style={styles.infoRow}>
            <Text style={[styles.pickHint, { color: colors.textSecondary }]}>
              {t('setlist_pick_hint', { min: state.minPrediction, max: state.maxPrediction })}
            </Text>
            {state.predictionCount > 0 && (
              <Text style={[styles.playersText, { color: colors.primary }]}>
                {t('setlist_players', { count: state.predictionCount })}
              </Text>
            )}
          </View>

          {renderCandidates()}
        </ScrollView>

        {/* ALT KAYDET ÇUBUĞU */}
        <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.selectedCount, { color: colors.text }]}>
            {t('setlist_selected', { count: selected.length })}
          </Text>
          <TouchableOpacity onPress={savePrediction} disabled={!canSave || saving} activeOpacity={0.85} style={{ flex: 1 }}>
            <LinearGradient
              colors={canSave ? ['#E94560', '#7C3AED'] : [colors.cardAlt, colors.cardAlt]}
              style={styles.saveBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.saveBtnText, !canSave && { color: colors.textSecondary }]}>
                  {savedFlash
                    ? t('setlist_saved')
                    : state.myPrediction ? t('setlist_update') : t('setlist_save')}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── SETLİST BİLDİRİM MODU (konser sonrası) ──────────────────────────────
  if (mode === 'confirm') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {renderHeader(t('setlist_confirm_sub'))}

          <View style={styles.infoRow}>
            <Text style={[styles.pickHint, { color: colors.text, fontWeight: '800' }]}>
              {t('setlist_confirm_title')}
            </Text>
            <TouchableOpacity onPress={openBoard}>
              <Text style={[styles.skipLink, { color: colors.primary }]}>{t('setlist_skip_results')}</Text>
            </TouchableOpacity>
          </View>

          {renderCandidates()}
        </ScrollView>

        <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.selectedCount, { color: colors.text }]}>
            {t('setlist_selected', { count: selected.length })}
          </Text>
          <TouchableOpacity
            onPress={submitConfirmation}
            disabled={selected.length === 0 || saving}
            activeOpacity={0.85}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={selected.length > 0 ? ['#00D4AA', '#3B82F6'] : [colors.cardAlt, colors.cardAlt]}
              style={styles.saveBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.saveBtnText, selected.length === 0 && { color: colors.textSecondary }]}>
                  {t('setlist_confirm_btn')}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── LİG TABLOSU ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {renderHeader(`${state.artistName} · ${state.eventName}`)}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('setlist_board_title')}</Text>

        {board?.confirmationCount === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('setlist_no_confirmations')}</Text>
        ) : (
          <>
            {/* Çalınan şarkılar */}
            <Text style={[styles.playedLabel, { color: colors.text }]}>
              {t('setlist_played', { count: board.playedSetlist.length })}
            </Text>
            <View style={styles.playedWrap}>
              {board.playedSetlist.map(titleItem => (
                <View key={titleItem} style={[styles.playedChip, { backgroundColor: '#00D4AA18', borderColor: '#00D4AA50' }]}>
                  <Text style={[styles.playedChipText, { color: '#00D4AA' }]}>🎵 {titleItem}</Text>
                </View>
              ))}
            </View>

            {/* Sıralama */}
            {board.rows.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('setlist_no_predictions')}</Text>
            ) : (
              board.rows.map((row, i) => {
                const isMe = row.userId === session.userId;
                return (
                  <View
                    key={`${row.userId}-${i}`}
                    style={[
                      styles.boardRow,
                      { backgroundColor: colors.card, borderColor: isMe ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.boardRank, { color: i < 3 ? '#F5A623' : colors.textSecondary }]}>
                      {i < 3 ? MEDALS[i] : `${i + 1}.`}
                    </Text>
                    <Text style={[styles.boardName, { color: isMe ? colors.primary : colors.text }]} numberOfLines={1}>
                      @{row.username}{isMe ? t('quiz_you') : ''}
                    </Text>
                    <Text style={[styles.boardHits, { color: colors.textSecondary }]}>
                      {t('setlist_hits', { hits: row.hits })}
                    </Text>
                    <Text style={[styles.boardScore, { color: colors.text }]}>{row.score}</Text>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 15, marginBottom: 20, textAlign: 'center', paddingHorizontal: 32 },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    retryBtnText: { color: '#fff', fontWeight: '700' },

    header: { paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20, gap: 6 },
    backText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    headerTitle: { fontSize: 24, fontWeight: '900' },
    headerSub: { fontSize: 13, lineHeight: 19 },

    infoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6, gap: 10,
    },
    pickHint: { fontSize: 13, fontWeight: '600', flex: 1 },
    playersText: { fontSize: 12, fontWeight: '700' },
    skipLink: { fontSize: 13, fontWeight: '700' },

    chipWrap: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1.5, borderRadius: 14,
      paddingVertical: 10, paddingHorizontal: 12,
    },
    chipCover: { width: 34, height: 34, borderRadius: 8 },
    chipText: { flex: 1, fontSize: 14, fontWeight: '700' },
    chipCheck: { fontSize: 16, fontWeight: '900' },

    bottomBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 28,
      borderTopWidth: 1,
    },
    selectedCount: { fontSize: 13, fontWeight: '800', minWidth: 86 },
    saveBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    sectionLabel: {
      fontSize: 12, fontWeight: '800', letterSpacing: 1.2,
      marginHorizontal: 20, marginTop: 20, marginBottom: 10,
    },
    playedLabel: { fontSize: 14, fontWeight: '800', marginHorizontal: 20, marginBottom: 8 },
    playedWrap: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      paddingHorizontal: 20, marginBottom: 20,
    },
    playedChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 6 },
    playedChipText: { fontSize: 12, fontWeight: '700' },

    boardRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginHorizontal: 16, marginBottom: 8,
      borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16,
    },
    boardRank: { fontSize: 16, fontWeight: '800', width: 34 },
    boardName: { flex: 1, fontSize: 14, fontWeight: '700' },
    boardHits: { fontSize: 12, fontWeight: '600' },
    boardScore: { fontSize: 16, fontWeight: '900', minWidth: 44, textAlign: 'right' },

    emptyText: { textAlign: 'center', marginTop: 14, fontSize: 14, paddingHorizontal: 32, lineHeight: 20 },
  });
}
