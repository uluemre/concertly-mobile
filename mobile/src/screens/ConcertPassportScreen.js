import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { buildShareUrl, shareWithLink } from '../services/shareLinks';
import API from '../services/api';
import EventImage from '../components/EventImage';
import { parseEventDate } from '../utils/time';
import { genreAccent } from '../utils/gradients';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';

// Gerçek pasaport damgaları gibi: her şehrin kendi mürekkep rengi, her damga biraz farklı açıda
const INKS = ['#00D4AA', '#F5A623', '#60A5FA', '#F472B6', '#A78BFA', '#34D399'];
function inkFor(city) {
  const s = String(city || '').toLocaleLowerCase('tr-TR');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return INKS[h % INKS.length];
}
const GOLD = '#E8C170';
const BADGE_GRADIENTS = [['#E94560', '#7C3AED'], ['#F5A623', '#E94560'], ['#00D4AA', '#3B82F6'], ['#7C3AED', '#00D4AA']];

const GOAL_OPTIONS = [5, 10, 15, 20, 25, 30, 50];
const GOAL_STORAGE_KEY = 'passport_concert_goal';

// Rozetler emoji yerine sade ikonla gösterilir (kodlar BadgeService'te).
const BADGE_ICONS = {
  ilk_konser: 'ticket',
  konser_kurdu: 'musical-notes',
  festival_sezonu: 'flame',
  efsane_seyirci: 'trophy',
  ilk_paylasim: 'create',
  sosyal_kelebek: 'people',
  icerik_ustasi: 'star',
  yeni_uye: 'sparkles',
};

function groupByYear(events) {
  const map = {};
  events.forEach(ev => {
    const year = parseEventDate(ev.eventDate).getFullYear();
    if (!map[year]) map[year] = [];
    map[year].push(ev);
  });
  return Object.entries(map)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, list]) => [year, list.sort((x, y) => parseEventDate(y.eventDate) - parseEventDate(x.eventDate))]);
}

export default function ConcertPassportScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t, tu, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';

  const targetUserId = route.params?.userId ?? session.userId;
  const isOwn = targetUserId === session.userId;

  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState(10);
  const goalAnim = useRef(new Animated.Value(0)).current;
  const year = new Date().getFullYear();

  useEffect(() => {
    AsyncStorage.getItem(GOAL_STORAGE_KEY).then(v => { if (v) setGoal(Number(v)); }).catch(() => {});
    API.get(`/users/${targetUserId}/passport`)
      .then(res => setPassport(res.data))
      .catch(err => console.log('passport error:', err.message))
      .finally(() => setLoading(false));
  }, [targetUserId]);

  const thisYearCount = useMemo(() => Number(passport?.concertsByYear?.[String(year)] || 0), [passport, year]);

  useEffect(() => {
    const pct = goal > 0 ? Math.min(thisYearCount / goal, 1) : 0;
    Animated.timing(goalAnim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [thisYearCount, goal]);

  const cycleGoal = () => {
    const idx = GOAL_OPTIONS.indexOf(goal);
    const next = GOAL_OPTIONS[(idx + 1) % GOAL_OPTIONS.length];
    setGoal(next);
    AsyncStorage.setItem(GOAL_STORAGE_KEY, String(next)).catch(() => {});
  };

  const handleShare = () => {
    if (!passport) return;
    const top = passport.topArtists?.[0]?.name;
    const msg = t('passport_share_message', {
      year, concerts: passport.totalConcerts, artists: passport.uniqueArtists, cities: passport.uniqueCities,
    }) + (top ? '\n' + t('passport_share_top', { artist: top }) : '');
    shareWithLink(msg, session.username ? buildShareUrl('user', session.username) : null);
  };

  const events = passport?.events || [];
  const yearGroups = useMemo(() => groupByYear([...events]), [passport]);
  // Sanatçı fotoğrafı için: sanatçının herhangi bir konser kaydı
  const artistSample = useMemo(() => {
    const m = {};
    events.forEach(e => { if (e.artistName && !m[e.artistName]) m[e.artistName] = e; });
    return m;
  }, [passport]);
  const badges = passport?.badges || [];

  if (loading) return (
    <View style={[styles.container, styles.centered]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  const stampDate = (iso) => {
    const d = parseEventDate(iso);
    return {
      day: d.getDate(),
      month: d.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toLocaleUpperCase(locale),
    };
  };

  return (
    <View style={styles.container}>
      {/* BAŞLIK */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile_passport')}</Text>
        {isOwn ? (
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn} hitSlop={10} accessibilityLabel={t('passport_share')}>
            <Ionicons name="share-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : <View style={styles.iconBtn} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* PASAPORT KAPAĞI */}
        {passport && (
          <View style={styles.cover}>
            <LinearGradient
              colors={['#7A1640', '#44102F', '#1E0818']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.coverRing1} />
            <View style={styles.coverRing2} />
            <View style={styles.emblem}>
              <Ionicons name="musical-notes" size={22} color={GOLD} />
            </View>
            <View style={styles.coverTop}>
              <Text style={styles.coverLabel}>{tu('passport_cover_label')}</Text>
              <Text style={styles.coverNo}>№ {String(targetUserId).padStart(6, '0')}</Text>
            </View>
            {(isOwn ? session.username : route.params?.username) ? (
              <Text style={styles.coverName}>@{isOwn ? session.username : route.params.username}</Text>
            ) : <View style={{ height: 12 }} />}

            <View style={styles.statsRow}>
              {[
                [passport.totalConcerts, t('passport_stat_concerts')],
                [passport.verifiedConcerts, t('passport_stat_verified')],
                [passport.uniqueArtists, t('passport_stat_artists')],
                [passport.uniqueCities, t('passport_stat_cities')],
              ].map(([value, label], i) => (
                <View key={label} style={[styles.stat, i > 0 && styles.statDivider]}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
                </View>
              ))}
            </View>

            {isOwn && (
              <View style={styles.goal}>
                <View style={styles.goalHead}>
                  <Text style={styles.goalLabel}>{t('passport_goal_label', { year })}</Text>
                  <TouchableOpacity onPress={cycleGoal} style={styles.goalChip} activeOpacity={0.8}>
                    <Text style={styles.goalChipText}>{thisYearCount} / {goal}</Text>
                    <Ionicons name="swap-vertical" size={12} color={GOLD} />
                  </TouchableOpacity>
                </View>
                <View style={styles.goalTrack}>
                  <Animated.View
                    style={[styles.goalFill, { width: goalAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
                  />
                </View>
                {thisYearCount >= goal && <Text style={styles.goalDone}>{t('passport_goal_done')}</Text>}
              </View>
            )}
          </View>
        )}

        {/* BOŞ DURUM */}
        {passport && events.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="ticket-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('passport_empty_title')}</Text>
            <Text style={styles.emptySub}>{isOwn ? t('passport_empty_sub') : t('passport_empty_sub_other')}</Text>
            {isOwn && (
              <TouchableOpacity
                onPress={() => navigation.navigate('MainApp', { screen: 'Events' })}
                activeOpacity={0.85}
                style={styles.emptyCta}
              >
                <Text style={styles.emptyCtaText}>{t('passport_empty_cta')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* DAMGALAR: yıl yıl, bilet koçanı kartları */}
        {yearGroups.map(([y, list]) => (
          <View key={y} style={styles.section}>
            <View style={styles.yearHead}>
              <Text style={styles.yearLabel}>{y}</Text>
              <Text style={styles.yearCount}>{t('passport_year_count', { count: list.length })}</Text>
            </View>
            {list.map(ev => {
              const d = stampDate(ev.eventDate);
              return (
                <TouchableOpacity
                  key={ev.id}
                  style={styles.stub}
                  onPress={() => openEvent(navigation, ev.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.stubDate}>
                    <Text style={styles.stubDay}>{d.day}</Text>
                    <Text style={styles.stubMonth}>{d.month}</Text>
                  </View>
                  <View style={styles.stubPerforation} />
                  <EventImage key={ev.id} item={ev} style={styles.stubImage} initialsSize={18} />
                  <View style={styles.stubInfo}>
                    <Text style={styles.stubName} numberOfLines={1}>{ev.name}</Text>
                    <Text style={styles.stubMeta} numberOfLines={1}>
                      {[ev.artistName !== ev.name ? ev.artistName : null, ev.venueCity].filter(Boolean).join(' · ')}
                    </Text>
                    {ev.genre ? <Text style={styles.stubGenre} numberOfLines={1}>{ev.genre}</Text> : null}
                  </View>
                  {ev.verified ? (
                    <View style={[styles.stamp, { borderColor: inkFor(ev.venueCity) + 'CC', transform: [{ rotate: `${(ev.id % 5) * 4 - 12}deg` }] }]}>
                      <View style={[styles.stampInner, { borderColor: inkFor(ev.venueCity) + '66' }]}>
                        <Text style={[styles.stampCity, { color: inkFor(ev.venueCity) }]} numberOfLines={1}>
                          {(ev.venueCity || '').toLocaleUpperCase(locale)}
                        </Text>
                        <View style={styles.stampRow}>
                          <Ionicons name="checkmark-circle" size={11} color={inkFor(ev.venueCity)} />
                          <Text style={[styles.stampText, { color: inkFor(ev.venueCity) }]}>{tu('passport_stamp_verified')}</Text>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* EN ÇOK GİTTİĞİN SANATÇILAR */}
        {passport?.topArtists?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('passport_section_top_artists')}</Text>
            {passport.topArtists.map((a, i) => {
              const max = passport.topArtists[0].count || 1;
              const sample = artistSample[a.name] || { name: a.name, artistName: a.name };
              return (
                <TouchableOpacity
                  key={a.name}
                  style={styles.artistRow}
                  activeOpacity={a.artistId ? 0.75 : 1}
                  onPress={() => a.artistId && navigation.navigate('ArtistProfile', { artistId: a.artistId, artistName: a.name })}
                >
                  <Text style={styles.artistRank}>{i + 1}</Text>
                  <EventImage item={{ ...sample, name: a.name, artistName: a.name }} style={styles.artistPhoto} initialsSize={15} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.artistHead}>
                      <Text style={styles.artistName} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.artistCount}>{t('passport_year_count', { count: a.count })}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.round((a.count / max) * 100)}%` }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* TÜRLER */}
        {passport?.topGenres?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('passport_section_music_taste')}</Text>
            <View style={styles.genreWrap}>
              {passport.topGenres.map(g => {
                const c = genreAccent(g.genre);
                return (
                  <View key={g.genre} style={[styles.genreChip, { backgroundColor: c + '22', borderColor: c + '66' }]}>
                    <Text style={[styles.genreChipText, { color: c }]}>{g.genre}</Text>
                    <View style={[styles.genreChipBadge, { backgroundColor: c }]}>
                      <Text style={styles.genreChipCount}>{g.count}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ROZETLER */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('passport_section_badges')}</Text>
            <View style={styles.badgeGrid}>
              {badges.map(b => {
                const icon = BADGE_ICONS[b.code] || 'ribbon';
                const pct = b.required > 0 ? Math.min(1, (b.progress || 0) / b.required) : 0;
                return (
                  <View key={b.code} style={[styles.badge, !b.earned && styles.badgeLocked]}>
                    {b.earned ? (
                      <LinearGradient
                        colors={BADGE_GRADIENTS[badges.indexOf(b) % BADGE_GRADIENTS.length]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.badgeIcon}
                      >
                        <Ionicons name={icon} size={20} color="#fff" />
                      </LinearGradient>
                    ) : (
                      <View style={[styles.badgeIcon, styles.badgeIconLocked]}>
                        <Ionicons name={`${icon}-outline`} size={20} color={colors.textSecondary} />
                      </View>
                    )}
                    <Text style={styles.badgeName} numberOfLines={2}>{b.name}</Text>
                    {b.earned ? (
                      <Text style={styles.badgeDesc} numberOfLines={2}>{b.description}</Text>
                    ) : b.required > 0 ? (
                      <>
                        <View style={styles.badgeTrack}>
                          <View style={[styles.badgeFill, { width: `${Math.round(pct * 100)}%` }]} />
                        </View>
                        <Text style={styles.badgeDesc}>{b.progress || 0}/{b.required}</Text>
                      </>
                    ) : (
                      <Text style={styles.badgeDesc}>{t('passport_locked')}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors) {
  const accent = colors.accent || '#00D4AA';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { justifyContent: 'center', alignItems: 'center' },

    header: {
      paddingTop: 54, paddingBottom: 10, paddingHorizontal: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    iconBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },

    // Kapak: bordo pasaport cildi, altın yazı
    cover: {
      marginHorizontal: 16, marginTop: 8, padding: 18, borderRadius: 22, overflow: 'hidden',
      borderWidth: 1, borderColor: GOLD + '40',
    },
    coverRing1: {
      position: 'absolute', right: -60, bottom: -80, width: 220, height: 220, borderRadius: 110,
      borderWidth: 1.5, borderColor: GOLD + '30',
    },
    coverRing2: {
      position: 'absolute', right: -30, bottom: -50, width: 160, height: 160, borderRadius: 80,
      borderWidth: 1.5, borderColor: GOLD + '22',
    },
    emblem: {
      position: 'absolute', right: 16, top: 42, width: 46, height: 46, borderRadius: 23,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: GOLD + '99',
    },
    coverTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    coverLabel: { color: GOLD, fontSize: 11, fontWeight: '900', letterSpacing: 2.4 },
    coverNo: { color: GOLD + 'BB', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    coverName: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 8, marginBottom: 16, marginRight: 56 },
    statsRow: {
      flexDirection: 'row', paddingVertical: 12, borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    stat: { flex: 1, alignItems: 'center' },
    statDivider: { borderLeftWidth: 1, borderLeftColor: GOLD + '33' },
    statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
    statLabel: { color: GOLD + 'CC', fontSize: 11, fontWeight: '700', marginTop: 2 },

    goal: { marginTop: 16 },
    goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    goalLabel: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
    goalChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: GOLD + '55',
    },
    goalChipText: { color: GOLD, fontSize: 12.5, fontWeight: '900' },
    goalTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' },
    goalFill: { height: '100%', borderRadius: 4, backgroundColor: GOLD },
    goalDone: { color: GOLD, fontSize: 12.5, fontWeight: '900', marginTop: 8 },

    // Boş
    emptyCard: {
      marginHorizontal: 16, marginTop: 14, padding: 20, borderRadius: 20, alignItems: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    emptyIcon: {
      width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary + '1F', marginBottom: 12,
    },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 6 },
    emptySub: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
    emptyCta: { alignSelf: 'stretch', paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: colors.primary },
    emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '800' },

    // Bölüm
    section: { paddingHorizontal: 16, marginTop: 22 },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 12 },
    yearHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
    yearLabel: { color: colors.text, fontSize: 22, fontWeight: '900' },
    yearCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },

    // Bilet koçanı
    stub: {
      flexDirection: 'row', alignItems: 'center', marginBottom: 10,
      borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
      overflow: 'hidden',
    },
    stubDate: { width: 56, alignItems: 'center', paddingVertical: 14 },
    stubDay: { color: colors.text, fontSize: 20, fontWeight: '900', lineHeight: 22 },
    stubMonth: { color: colors.primary, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 },
    stubPerforation: {
      alignSelf: 'stretch', width: 0, marginVertical: 6,
      borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border,
    },
    stubImage: { width: 52, height: 52, borderRadius: 12, marginLeft: 12 },
    stubInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
    stubName: { color: colors.text, fontSize: 14.5, fontWeight: '800' },
    stubMeta: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2 },
    stubGenre: { color: colors.primary, fontSize: 11, fontWeight: '800', marginTop: 3 },
    // Mürekkep damgası: çift çizgili, şehir adlı; renk ve açı şehre/konsere göre
    stamp: { marginRight: 10, padding: 2, borderRadius: 9, borderWidth: 2 },
    stampInner: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignItems: 'center', maxWidth: 92 },
    stampCity: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
    stampRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
    stampText: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 },

    // Sanatçılar
    artistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    artistRank: { width: 16, color: colors.textSecondary, fontSize: 14, fontWeight: '900', textAlign: 'center' },
    artistPhoto: { width: 40, height: 40, borderRadius: 20 },
    artistHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    artistName: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: '800' },
    artistCount: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    barTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border },
    barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },

    // Türler
    genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    genreChip: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingLeft: 12, paddingRight: 5, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
    },
    genreChipText: { fontSize: 13.5, fontWeight: '900' },
    genreChipBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
    genreChipCount: { color: '#fff', fontSize: 11.5, fontWeight: '900' },

    // Rozetler
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: {
      width: '31%', flexGrow: 1, maxWidth: '32%', padding: 10, borderRadius: 16, alignItems: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    badgeLocked: { opacity: 0.75 },
    badgeIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    badgeIconLocked: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    badgeName: { color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'center' },
    badgeDesc: { color: colors.textSecondary, fontSize: 10.5, textAlign: 'center', marginTop: 3, lineHeight: 14 },
    badgeTrack: { width: '80%', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.border, marginTop: 6 },
    badgeFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  });
}
