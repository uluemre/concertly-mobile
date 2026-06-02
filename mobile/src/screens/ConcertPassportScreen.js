import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Share, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

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
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByYear(events) {
  const map = {};
  events.forEach(ev => {
    const year = new Date(ev.eventDate).getFullYear();
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

  useEffect(() => {
    API.get(`/users/${targetUserId}/passport`)
      .then(res => setPassport(res.data))
      .catch(err => console.log('passport error:', err.message))
      .finally(() => setLoading(false));
  }, [targetUserId]);

  const handleShare = async () => {
    if (!passport) return;
    const year = new Date().getFullYear();
    const msg = `🎸 ${year} Konser Pasaportu\n\n`
      + `🎟️ ${passport.totalConcerts} konser\n`
      + `✅ ${passport.verifiedConcerts} doğrulanmış\n`
      + `🎤 ${passport.uniqueArtists} farklı sanatçı\n`
      + `📍 ${passport.uniqueCities} farklı şehir\n\n`
      + `Concertly ile müziği yaşa 🎵`;
    Share.share({ message: msg });
  };

  const yearGroups = useMemo(() => passport ? groupByYear(passport.events) : [], [passport]);

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
        <Text style={styles.headerTitle}>🎟️ Konser Pasaportu</Text>
        {isOwn && (
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>Paylaş ↑</Text>
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
              <StatBox value={passport.totalConcerts}    label="Konser"      emoji="🎟️" />
              <StatBox value={passport.verifiedConcerts} label="Doğrulanmış" emoji="✅" />
              <StatBox value={passport.uniqueArtists}    label="Sanatçı"     emoji="🎤" />
              <StatBox value={passport.uniqueCities}     label="Şehir"       emoji="📍" />
            </View>

            {/* Yıl bar chart */}
            {Object.keys(passport.concertsByYear || {}).length > 0 && (
              <View style={styles.yearBars}>
                {Object.entries(passport.concertsByYear)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([year, count]) => {
                    const maxCount = Math.max(...Object.values(passport.concertsByYear));
                    const pct = maxCount > 0 ? (count / maxCount) : 0;
                    return (
                      <View key={year} style={styles.yearBarItem}>
                        <Text style={styles.yearBarCount}>{count}</Text>
                        <View style={styles.yearBarTrack}>
                          <View style={[styles.yearBarFill, { height: `${Math.max(pct * 100, 8)}%` }]} />
                        </View>
                        <Text style={styles.yearBarLabel}>{year}</Text>
                      </View>
                    );
                  })}
              </View>
            )}
          </LinearGradient>
        )}

        {/* BOŞ DURUM */}
        {passport?.events?.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz konser yok</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Etkinliklere "Gidiyorum" de ve konserlerin burada birikim yapsın.
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

            {events.map((ev, i) => (
              <TouchableOpacity
                key={ev.id}
                style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => navigation.navigate('EventDetail', { event: ev })}
                activeOpacity={0.85}
              >
                {/* Sol renk çizgisi */}
                <View style={[styles.eventAccent, { backgroundColor: genreColor(ev.genre) }]} />

                {/* Görsel */}
                <View style={styles.eventImgWrap}>
                  {ev.imageUrl ? (
                    <Image
                      source={{ uri: ev.imageUrl }}
                      style={styles.eventImg}
                      contentFit="cover"
                    />
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
                </View>

                {/* Bilgi */}
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>
                    {ev.name}
                  </Text>
                  {ev.artistName && (
                    <Text style={[styles.eventArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                      🎤 {ev.artistName}
                    </Text>
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
                    <View style={[styles.genreChip, { backgroundColor: genreColor(ev.genre) + '22', borderColor: genreColor(ev.genre) + '60' }]}>
                      <Text style={[styles.genreChipText, { color: genreColor(ev.genre) }]}>{ev.genre}</Text>
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
    Animated.timing(animVal, {
      toValue: value,
      duration: 900,
      useNativeDriver: false,
    }).start();
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

    // YIL BAR CHART
    yearBars: {
      flexDirection: 'row', alignItems: 'flex-end',
      height: 60, gap: 8, paddingTop: 8,
    },
    yearBarItem: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    yearBarCount: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginBottom: 3 },
    yearBarTrack: {
      width: '100%', flex: 1, maxHeight: 40,
      backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4,
      justifyContent: 'flex-end', overflow: 'hidden',
    },
    yearBarFill: { width: '100%', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 4 },
    yearBarLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '600' },

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
    eventArtist: { fontSize: 12, marginBottom: 4 },
    eventMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
    eventCity: { fontSize: 11 },
    eventDate: { fontSize: 11 },
    genreChip: {
      alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
      paddingHorizontal: 7, paddingVertical: 2,
    },
    genreChipText: { fontSize: 10, fontWeight: '700' },
    chevron: { fontSize: 22, paddingRight: 12 },
  });
}
