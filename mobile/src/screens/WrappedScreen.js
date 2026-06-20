import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { parseEventDate } from '../utils/time';

// Baskın türe göre müzik kişiliği
const PERSONALITIES = [
  { match: ['rock', 'metal', 'alternative', 'indie'], key: 'wrapped_p_rock',    emoji: '🎸', gradient: ['#E94560', '#7C3AED'] },
  { match: ['pop'],                                   key: 'wrapped_p_pop',     emoji: '✨', gradient: ['#EC4899', '#F5A623'] },
  { match: ['electronic', 'dance', 'house', 'techno', 'edm'], key: 'wrapped_p_electronic', emoji: '🎧', gradient: ['#00D4AA', '#3B82F6'] },
  { match: ['jazz', 'blues', 'soul', 'funk'],         key: 'wrapped_p_jazz',    emoji: '🎷', gradient: ['#F5A623', '#D97706'] },
  { match: ['rap', 'hip-hop', 'hip hop'],             key: 'wrapped_p_rap',     emoji: '🎤', gradient: ['#3B82F6', '#7C3AED'] },
  { match: ['folk', 'world', 'türk', 'arabesk'],      key: 'wrapped_p_folk',    emoji: '🪕', gradient: ['#00D4AA', '#F5A623'] },
];
const PERSONALITY_DEFAULT = { key: 'wrapped_p_explorer', emoji: '🧭', gradient: ['#7C3AED', '#00D4AA'] };

function pickPersonality(genreCounts) {
  const entries = Object.entries(genreCounts);
  if (entries.length === 0) return { ...PERSONALITY_DEFAULT, percent: 0 };
  const total = entries.reduce((s, [, c]) => s + c, 0);
  const [topGenre, topCount] = entries.sort((a, b) => b[1] - a[1])[0];
  const g = topGenre.toLowerCase();
  const found = PERSONALITIES.find(p => p.match.some(m => g.includes(m)));
  return { ...(found || PERSONALITY_DEFAULT), percent: Math.round(topCount * 100 / total), genre: topGenre };
}

function FadeIn({ delay, children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

export default function WrappedScreen({ navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get(`/users/${session.userId}/passport`)
      .then(res => setPassport(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Pasaport verisinden kimlik çıkarımı ─────────────────────────────────
  const identity = useMemo(() => {
    const events = passport?.events || [];

    const genreCounts = {};
    const artistCounts = {};
    const monthCounts = {};
    events.forEach(e => {
      if (e.genre) genreCounts[e.genre] = (genreCounts[e.genre] || 0) + 1;
      if (e.artistName) artistCounts[e.artistName] = (artistCounts[e.artistName] || 0) + 1;
      if (e.eventDate) {
        const m = parseEventDate(e.eventDate).getMonth();
        monthCounts[m] = (monthCounts[m] || 0) + 1;
      }
    });

    // Konser yoksa profildeki favori türlerden kişilik çıkar
    if (events.length === 0 && session.favoriteGenres) {
      session.favoriteGenres.split(',').map(g => g.trim()).filter(Boolean)
        .forEach(g => { genreCounts[g] = 1; });
    }

    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0] || null;
    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const genreTotal = Object.values(genreCounts).reduce((s, c) => s + c, 0) || 1;
    const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0] || null;

    const monthName = topMonth !== null && topMonth !== undefined && topMonth[0] !== undefined
      ? new Date(2026, parseInt(topMonth[0]), 1).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', { month: 'long' })
      : null;

    return {
      personality: pickPersonality(genreCounts),
      topArtist,
      topGenres: topGenres.map(([g, c]) => ({ genre: g, percent: Math.round(c * 100 / genreTotal) })),
      topMonth: topMonth ? { name: monthName, count: topMonth[1] } : null,
    };
  }, [passport, session.favoriteGenres, lang]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const p = passport || { totalConcerts: 0, verifiedConcerts: 0, uniqueArtists: 0, uniqueCities: 0, events: [] };
  const hasData = p.totalConcerts > 0;
  const year = new Date().getFullYear();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* HERO — KİŞİLİK */}
      <LinearGradient colors={identity.personality.gradient} style={styles.hero}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroBack}>
          <Text style={styles.heroBackText}>‹</Text>
        </TouchableOpacity>
        <FadeIn delay={100}>
          <Text style={styles.heroLabel}>{t('wrapped_title', { year })}</Text>
        </FadeIn>
        <FadeIn delay={400}>
          <Text style={styles.heroEmoji}>{identity.personality.emoji}</Text>
        </FadeIn>
        <FadeIn delay={700}>
          <Text style={styles.heroPersonality}>{t(identity.personality.key)}</Text>
        </FadeIn>
        <FadeIn delay={1000}>
          <Text style={styles.heroSub}>
            {identity.personality.percent > 0
              ? t('wrapped_personality_sub', { percent: identity.personality.percent, genre: identity.personality.genre })
              : t('wrapped_personality_new')}
          </Text>
        </FadeIn>
      </LinearGradient>

      {hasData ? (
        <>
          {/* İSTATİSTİK GRID */}
          <FadeIn delay={1200}>
            <View style={styles.statsGrid}>
              {[
                { num: p.totalConcerts,    labelKey: 'wrapped_stat_concerts', emoji: '🎫' },
                { num: p.uniqueCities,     labelKey: 'wrapped_stat_cities',   emoji: '🗺️' },
                { num: p.uniqueArtists,    labelKey: 'wrapped_stat_artists',  emoji: '🎤' },
                { num: p.verifiedConcerts, labelKey: 'wrapped_stat_verified', emoji: '✅' },
              ].map(s => (
                <View key={s.labelKey} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.statEmoji}>{s.emoji}</Text>
                  <Text style={[styles.statNum, { color: colors.text }]}>{s.num}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t(s.labelKey)}</Text>
                </View>
              ))}
            </View>
          </FadeIn>

          {/* EN ÇOK GÖRÜLEN SANATÇI */}
          {identity.topArtist && (
            <FadeIn delay={1400}>
              <View style={[styles.bigCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.bigCardLabel, { color: colors.textSecondary }]}>{t('wrapped_top_artist')}</Text>
                <Text style={[styles.bigCardValue, { color: colors.text }]}>🌟 {identity.topArtist[0]}</Text>
                <Text style={[styles.bigCardSub, { color: colors.textSecondary }]}>
                  {t('wrapped_top_artist_sub', { count: identity.topArtist[1] })}
                </Text>
              </View>
            </FadeIn>
          )}

          {/* TÜR DAĞILIMI */}
          {identity.topGenres.length > 0 && (
            <FadeIn delay={1600}>
              <View style={[styles.bigCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.bigCardLabel, { color: colors.textSecondary }]}>{t('wrapped_genres')}</Text>
                {identity.topGenres.map((g, i) => (
                  <View key={g.genre} style={styles.genreRow}>
                    <Text style={[styles.genreName, { color: colors.text }]}>{g.genre}</Text>
                    <View style={[styles.genreBarTrack, { backgroundColor: colors.cardAlt }]}>
                      <LinearGradient
                        colors={identity.personality.gradient}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.genreBarFill, { width: `${Math.max(8, g.percent)}%` }]}
                      />
                    </View>
                    <Text style={[styles.genrePercent, { color: colors.textSecondary }]}>%{g.percent}</Text>
                  </View>
                ))}
              </View>
            </FadeIn>
          )}

          {/* EN YOĞUN AY */}
          {identity.topMonth && (
            <FadeIn delay={1800}>
              <View style={[styles.bigCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.bigCardLabel, { color: colors.textSecondary }]}>{t('wrapped_busy_month')}</Text>
                <Text style={[styles.bigCardValue, { color: colors.text }]}>📅 {identity.topMonth.name}</Text>
                <Text style={[styles.bigCardSub, { color: colors.textSecondary }]}>
                  {t('wrapped_busy_month_sub', { count: identity.topMonth.count })}
                </Text>
              </View>
            </FadeIn>
          )}

          {/* PASAPORTA GİT */}
          <FadeIn delay={2000}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ConcertPassport')}
              activeOpacity={0.85}
              style={styles.passportBtnWrap}
            >
              <LinearGradient
                colors={identity.personality.gradient}
                style={styles.passportBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.passportBtnText}>{t('wrapped_open_passport')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('GenreSelection', { editMode: true })}
              activeOpacity={0.8}
              style={[styles.prefsBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.prefsBtnText, { color: colors.textSecondary }]}>{t('wrapped_edit_prefs')}</Text>
            </TouchableOpacity>
          </FadeIn>
        </>
      ) : (
        /* BOŞ DURUM */
        <FadeIn delay={1200}>
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🎫</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('wrapped_empty_title')}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t('wrapped_empty_sub')}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MainApp', { screen: 'Events' })}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#E94560', '#7C3AED']}
                style={styles.passportBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.passportBtnText}>{t('wrapped_browse_events')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('GenreSelection', { editMode: true })}
              activeOpacity={0.8}
              style={[styles.prefsBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.prefsBtnText, { color: colors.textSecondary }]}>{t('wrapped_edit_prefs')}</Text>
            </TouchableOpacity>
          </View>
        </FadeIn>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center' },

    hero: { paddingTop: 56, paddingBottom: 38, paddingHorizontal: 24, alignItems: 'center' },
    heroBack: { alignSelf: 'flex-start' },
    heroBackText: { color: '#fff', fontSize: 34, fontWeight: '600', lineHeight: 36 },
    heroLabel: {
      color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800',
      letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18, textAlign: 'center',
    },
    heroEmoji: { fontSize: 72, textAlign: 'center', marginBottom: 12 },
    heroPersonality: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
    heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 20 },

    statsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 12,
      paddingHorizontal: 16, marginTop: 18,
    },
    statCard: {
      flexBasis: '47%', flexGrow: 1,
      borderRadius: 18, borderWidth: 1, padding: 16, alignItems: 'center', gap: 4,
    },
    statEmoji: { fontSize: 24 },
    statNum: { fontSize: 28, fontWeight: '900' },
    statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

    bigCard: {
      marginHorizontal: 16, marginTop: 14,
      borderRadius: 18, borderWidth: 1, padding: 18, gap: 6,
    },
    bigCardLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
    bigCardValue: { fontSize: 22, fontWeight: '900' },
    bigCardSub: { fontSize: 13 },

    genreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    genreName: { width: 90, fontSize: 13, fontWeight: '700' },
    genreBarTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
    genreBarFill: { height: 10, borderRadius: 5 },
    genrePercent: { width: 42, fontSize: 12, fontWeight: '700', textAlign: 'right' },

    passportBtnWrap: { marginHorizontal: 16, marginTop: 20 },
    passportBtn: { paddingVertical: 15, paddingHorizontal: 28, borderRadius: 16, alignItems: 'center' },
    passportBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    prefsBtn: {
      marginTop: 10, paddingVertical: 13, paddingHorizontal: 24, borderRadius: 16,
      alignItems: 'center', borderWidth: 1,
    },
    prefsBtnText: { fontSize: 13, fontWeight: '700' },

    emptyWrap: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40, gap: 12 },
    emptyEmoji: { fontSize: 56 },
    emptyTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 10 },
  });
}
