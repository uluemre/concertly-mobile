import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Share, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { parseEventDate } from '../utils/time';

const GOAL_OPTIONS = [5, 10, 15, 20, 25, 30, 50];
const GOAL_STORAGE_KEY = 'passport_concert_goal';

const { width } = Dimensions.get('window');

const GENRE_COLORS = {
  Rock: '#E94560', Metal: '#7C3AED', Pop: '#F5A623',
  Rap: '#3B82F6', Elektronik: '#00D4AA', Caz: '#F59E0B',
  Indie: '#8B5CF6', Electronic: '#00D4AA', Jazz: '#F59E0B',
};
function genreColor(g) {
  if (!g) return '#7C3AED';
  const key = Object.keys(GENRE_COLORS).find(k => g.toLowerCase().includes(k.toLowerCase()));
  return key ? GENRE_COLORS[key] : '#7C3AED';
}

function formatDate(iso) {
  if (!iso) return '';
  return parseEventDate(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByYear(events) {
  const map = {};
  events.forEach(ev => {
    const year = parseEventDate(ev.eventDate).getFullYear();
    if (!map[year]) map[year] = [];
    map[year].push(ev);
  });
  return Object.entries(map).sort(([a], [b]) => Number(b) - Number(a));
}

export default function ConcertPassportScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();

  const targetUserId = route.params?.userId ?? session.userId;
  const isOwn = targetUserId === session.userId;

  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState(10);
  const goalAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(GOAL_STORAGE_KEY).then(v => { if (v) setGoal(Number(v)); });
    API.get(`/users/${targetUserId}/passport`)
      .then(res => setPassport(res.data))
      .catch(err => console.log('passport error:', err.message))
      .finally(() => setLoading(false));
  }, [targetUserId]);

  // Bu yılki konser sayısı
  const thisYearCount = useMemo(() => {
    if (!passport?.concertsByYear) return 0;
    const year = String(new Date().getFullYear());
    return Number(passport.concertsByYear[year] || 0);
  }, [passport]);

  useEffect(() => {
    const pct = goal > 0 ? Math.min(thisYearCount / goal, 1) : 0;
    Animated.timing(goalAnim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [thisYearCount, goal]);

  const cycleGoal = () => {
    const idx = GOAL_OPTIONS.indexOf(goal);
    const next = GOAL_OPTIONS[(idx + 1) % GOAL_OPTIONS.length];
    setGoal(next);
    AsyncStorage.setItem(GOAL_STORAGE_KEY, String(next));
  };

  const handleShare = async () => {
    if (!passport) return;
    const year = new Date().getFullYear();
    const topArtist = passport.topArtists?.[0]?.name;
    const msg = `🎸 ${year} Konser Pasaportu\n\n`
      + `🎟️ ${passport.totalConcerts} konser\n`
      + `✅ ${passport.verifiedConcerts} doğrulanmış\n`
      + `🎤 ${passport.uniqueArtists} farklı sanatçı\n`
      + `📍 ${passport.uniqueCities} farklı şehir\n`
      + (topArtist ? `⭐ En çok: ${topArtist}\n` : '')
      + `\nConcertly ile müziği yaşa 🎵`;
    Share.share({ message: msg });
  };

  const yearGroups = useMemo(() => passport ? groupByYear(passport.events) : [], [passport]);
  const earnedBadges = useMemo(() => (passport?.badges || []).filter(b => b.earned), [passport]);
  const lockedBadges = useMemo(() => (passport?.badges || []).filter(b => !b.earned), [passport]);

  if (loading) return (
    <View style={[styles.container, styles.centered]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={['#1A0A2E', '#0A1628', '#0A0A14']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎟️ {t('profile_passport')}</Text>
        {isOwn && (
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>{t('passport_share')}</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* STATS KARTI */}
        {passport && (
          <LinearGradient
            colors={['#E94560', '#7C3AED', '#00D4AA']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.statsCard}
          >
            <View style={styles.statsGrid}>
              <StatBox value={passport.totalConcerts}    label={t('passport_stat_concerts')} emoji="🎟️" />
              <StatBox value={passport.verifiedConcerts} label={t('passport_stat_verified')} emoji="✅" />
              <StatBox value={passport.uniqueArtists}    label={t('passport_stat_artists')}  emoji="🎤" />
              <StatBox value={passport.uniqueCities}     label={t('passport_stat_cities')}   emoji="📍" />
            </View>

            {/* Yıllık hedef */}
            {isOwn && (
              <View style={styles.goalWrap}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalLabel}>
                    🎯 {new Date().getFullYear()} Hedefi
                  </Text>
                  <TouchableOpacity onPress={cycleGoal} style={styles.goalBtn}>
                    <Text style={styles.goalBtnText}>{goal} konser ›</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.goalTrack}>
                  <Animated.View
                    style={[
                      styles.goalFill,
                      { width: goalAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                    ]}
                  />
                </View>

                <View style={styles.goalFooter}>
                  <Text style={styles.goalProgress}>
                    {thisYearCount} / {goal} konser
                  </Text>
                  <Text style={styles.goalPct}>
                    %{Math.round(Math.min(thisYearCount / goal, 1) * 100)}
                  </Text>
                </View>

                {thisYearCount >= goal && (
                  <Text style={styles.goalDone}>🎉 {t('passport_goal_done')}</Text>
                )}
              </View>
            )}
          </LinearGradient>
        )}

        {/* BOŞ DURUM — henüz konser yok, kullanıcıyı yönlendir */}
        {isOwn && passport && passport.totalConcerts === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.emptyEmoji}>🎟️</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('passport_empty_title')}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t('passport_empty_sub')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainApp', { screen: 'Events' })} activeOpacity={0.85} style={{ width: '100%' }}>
              <LinearGradient
                colors={['#E94560', '#7C3AED']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.emptyCta}
              >
                <Text style={styles.emptyCtaText}>{t('passport_empty_cta')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ROZETLER */}
        {passport?.badges?.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🏅 {t('passport_section_badges')}</Text>

            {/* Kazanılmış */}
            {earnedBadges.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
                {earnedBadges.map(badge => (
                  <View key={badge.code} style={styles.badgeCard}>
                    <LinearGradient
                      colors={['#E94560', '#7C3AED']}
                      style={styles.badgeIconWrap}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.badgeEmoji}>{badge.icon}</Text>
                    </LinearGradient>
                    <Text style={[styles.badgeName, { color: colors.text }]} numberOfLines={2}>
                      {badge.name}
                    </Text>
                    <Text style={[styles.badgeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {badge.description}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Kilitli */}
            {lockedBadges.length > 0 && (
              <View style={styles.lockedRow}>
                <Text style={[styles.lockedLabel, { color: colors.textSecondary }]}>{t('passport_locked')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {lockedBadges.map(badge => (
                    <View key={badge.code} style={[styles.badgeCard, styles.badgeCardLocked]}>
                      <View style={[styles.badgeIconWrap, { backgroundColor: colors.border }]}>
                        <Text style={[styles.badgeEmoji, { opacity: 0.35 }]}>{badge.icon}</Text>
                      </View>
                      <Text style={[styles.badgeName, { color: colors.textSecondary }]} numberOfLines={2}>
                        {badge.name}
                      </Text>
                      {badge.required > 0 && (
                        <View style={styles.progressWrap}>
                          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                            <View style={[
                              styles.progressFill,
                              { width: `${Math.round((badge.progress / badge.required) * 100)}%` },
                            ]} />
                          </View>
                          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                            {badge.progress}/{badge.required}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* TOP SANATÇILAR */}
        {passport?.topArtists?.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🎤 {t('passport_section_top_artists')}</Text>
            {passport.topArtists.map((item, i) => {
              const maxCount = passport.topArtists[0].count;
              const pct = maxCount > 0 ? item.count / maxCount : 0;
              return (
                <TouchableOpacity
                  key={item.name}
                  style={styles.topArtistRow}
                  activeOpacity={item.artistId ? 0.7 : 1}
                  onPress={() => item.artistId && navigation.navigate('ArtistProfile', { artistId: item.artistId, artistName: item.name })}
                >
                  <Text style={[styles.topArtistRank, { color: colors.textSecondary }]}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </Text>
                  <View style={styles.topArtistInfo}>
                    <View style={styles.topArtistNameRow}>
                      <Text style={[styles.topArtistName, { color: item.artistId ? colors.primary : colors.text }]}>
                        {item.name}{item.artistId ? ' ›' : ''}
                      </Text>
                      <Text style={[styles.topArtistCount, { color: colors.textSecondary }]}>
                        {item.count} konser
                      </Text>
                    </View>
                    <View style={[styles.topArtistTrack, { backgroundColor: colors.border }]}>
                      <LinearGradient
                        colors={['#E94560', '#7C3AED']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.topArtistFill, { width: `${Math.round(pct * 100)}%` }]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* TÜR DAĞILIMI */}
        {passport?.topGenres?.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🎵 {t('passport_section_music_taste')}</Text>
            <View style={styles.genreChips}>
              {passport.topGenres.map((item, i) => {
                const color = genreColor(item.genre);
                const sizes = [22, 18, 16, 14, 13];
                return (
                  <View key={item.genre} style={[styles.genreChip, { backgroundColor: color + '22', borderColor: color + '60' }]}>
                    <Text style={[styles.genreChipText, { color, fontSize: sizes[i] || 13 }]}>
                      {item.genre}
                    </Text>
                    <Text style={[styles.genreChipCount, { color }]}>×{item.count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* BOŞ DURUM */}
        {passport?.events?.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('passport_no_concerts')}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {t('passport_no_concerts_sub')}
            </Text>
          </View>
        )}

        {/* YIL BAZLI TİMELINE */}
        {yearGroups.map(([year, events]) => (
          <View key={year} style={styles.yearSection}>
            <View style={styles.yearHeader}>
              <View style={[styles.yearLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.yearLabel, { color: colors.text }]}>{year}</Text>
              <View style={[styles.yearLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.yearCount, { color: colors.textSecondary }]}>
                {events.length} konser
              </Text>
            </View>

            {events.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => navigation.navigate('EventDetail', { event: ev })}
                activeOpacity={0.85}
              >
                <View style={[styles.eventAccent, { backgroundColor: genreColor(ev.genre) }]} />

                <View style={styles.eventImgWrap}>
                  {ev.imageUrl ? (
                    <Image source={{ uri: ev.imageUrl }} style={styles.eventImg} contentFit="cover" />
                  ) : (
                    <LinearGradient
                      colors={[genreColor(ev.genre) + 'CC', genreColor(ev.genre) + '44']}
                      style={styles.eventImg}
                    >
                      <Text style={{ fontSize: 24 }}>🎸</Text>
                    </LinearGradient>
                  )}
                  {ev.verified && (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>✅</Text>
                    </View>
                  )}
                  {passport?.bingoEventIds?.includes(ev.id) && (
                    <View style={[styles.verifiedBadge, { bottom: -4, right: 18, backgroundColor: '#1a0a2e' }]}>
                      <Text style={styles.verifiedText}>🎲</Text>
                    </View>
                  )}
                </View>

                <View style={styles.eventInfo}>
                  <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>
                    {ev.name}
                  </Text>
                  {ev.artistName && (
                    ev.artistId ? (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('ArtistProfile', { artistId: ev.artistId, artistName: ev.artistName })}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
                      >
                        <Text style={[styles.eventArtist, styles.eventArtistLink]} numberOfLines={1}>
                          🎤 {ev.artistName} ›
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.eventArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                        🎤 {ev.artistName}
                      </Text>
                    )
                  )}
                  <View style={styles.eventMeta}>
                    {ev.venueCity && (
                      <Text style={[styles.eventCity, { color: colors.textSecondary }]}>
                        📍 {ev.venueCity}
                      </Text>
                    )}
                    <Text style={[styles.eventDate, { color: colors.textSecondary }]}>
                      {formatDate(ev.eventDate)}
                    </Text>
                  </View>
                  {ev.genre && (
                    <View style={[styles.genreChipSmall, { backgroundColor: genreColor(ev.genre) + '22', borderColor: genreColor(ev.genre) + '60' }]}>
                      <Text style={[styles.genreChipSmallText, { color: genreColor(ev.genre) }]}>{ev.genre}</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

      </ScrollView>
    </View>
  );
}

function StatBox({ value, label, emoji }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(animVal, { toValue: value, duration: 900, useNativeDriver: false }).start();
    const id = animVal.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => animVal.removeListener(id);
  }, [value]);

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 4 }}>{display}</Text>
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { justifyContent: 'center', alignItems: 'center' },

    header: {
      paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    backBtn: {},
    backText: { fontSize: 17, fontWeight: '700' },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
    shareBtn: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    // STATS
    statsCard: {
      margin: 16, borderRadius: 24, padding: 24,
      shadowColor: '#E94560', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
    },
    statsGrid: { flexDirection: 'row', marginBottom: 24 },

    // BOŞ DURUM
    emptyCard: {
      marginHorizontal: 16, marginBottom: 8, borderRadius: 20, borderWidth: 1,
      padding: 24, alignItems: 'center',
    },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    emptySub: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18 },
    emptyCta: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '800' },

    // HEDEF PROGRESS
    goalWrap: { marginTop: 8 },
    goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    goalLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' },
    goalBtn: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    },
    goalBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    goalTrack: {
      height: 10, borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
    },
    goalFill: {
      height: '100%', borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.85)',
    },
    goalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    goalProgress: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
    goalPct: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800' },
    goalDone: { color: '#fff', fontSize: 13, fontWeight: '900', textAlign: 'center', marginTop: 8 },

    // BÖLÜM
    section: { paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 14, letterSpacing: 0.3 },

    // ROZETLER
    badgeScroll: { marginBottom: 4 },
    badgeCard: {
      width: 110, marginRight: 12,
      alignItems: 'center', paddingVertical: 12,
    },
    badgeCardLocked: { opacity: 0.7 },
    badgeIconWrap: {
      width: 64, height: 64, borderRadius: 32,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 8,
    },
    badgeEmoji: { fontSize: 30 },
    badgeName: { fontSize: 12, fontWeight: '800', textAlign: 'center', marginBottom: 3 },
    badgeDesc: { fontSize: 10, textAlign: 'center', lineHeight: 14 },
    lockedRow: { marginTop: 8 },
    lockedLabel: { fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    progressWrap: { width: '100%', alignItems: 'center', marginTop: 4 },
    progressTrack: { width: '80%', height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 2 },
    progressText: { fontSize: 9, marginTop: 3, fontWeight: '700' },

    // TOP SANATÇILAR
    topArtistRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    topArtistRank: { width: 32, fontSize: 18, textAlign: 'center' },
    topArtistInfo: { flex: 1 },
    topArtistNameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    topArtistName: { fontSize: 14, fontWeight: '800', flex: 1 },
    topArtistCount: { fontSize: 12, fontWeight: '600' },
    topArtistTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    topArtistFill: { height: '100%', borderRadius: 3 },

    // TÜR DAĞILIMI
    genreChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    genreChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1,
    },
    genreChipText: { fontWeight: '900' },
    genreChipCount: { fontSize: 11, fontWeight: '700', opacity: 0.75 },

    // BOŞ
    emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 21 },

    // YIL HEADER
    yearSection: { paddingHorizontal: 16, marginTop: 8 },
    yearHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginBottom: 12, marginTop: 8,
    },
    yearLine: { flex: 1, height: 1 },
    yearLabel: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    yearCount: { fontSize: 12, fontWeight: '600' },

    // EVENT KARTI
    eventCard: {
      flexDirection: 'row', alignItems: 'center',
      borderRadius: 16, borderWidth: 1,
      marginBottom: 10, overflow: 'hidden',
    },
    eventAccent: { width: 4, alignSelf: 'stretch' },
    eventImgWrap: { position: 'relative', margin: 12 },
    eventImg: {
      width: 64, height: 64, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
    },
    verifiedBadge: {
      position: 'absolute', bottom: -4, right: -4,
      backgroundColor: colors.card,
      borderRadius: 10, width: 20, height: 20,
      justifyContent: 'center', alignItems: 'center',
    },
    verifiedText: { fontSize: 12 },
    eventInfo: { flex: 1, paddingVertical: 12, paddingRight: 4 },
    eventName: { fontSize: 14, fontWeight: '800', marginBottom: 3, lineHeight: 18 },
    eventArtist: { fontSize: 12, marginBottom: 4, color: colors.textSecondary },
    eventArtistLink: { color: colors.primary, fontWeight: '700' },
    eventMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
    eventCity: { fontSize: 11 },
    eventDate: { fontSize: 11 },
    genreChipSmall: {
      alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
      paddingHorizontal: 7, paddingVertical: 2,
    },
    genreChipSmallText: { fontSize: 10, fontWeight: '700' },
    chevron: { fontSize: 22, paddingRight: 12 },
  });
}
