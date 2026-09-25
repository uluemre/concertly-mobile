import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import EventCard from '../components/EventCard';
import EventImage from '../components/EventImage';
import { parseEventDate } from '../utils/time';
import { getGenreGradient } from '../utils/gradients';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';

/**
 * Konser Yılın: kullanıcının bu yıl gittiği konserlerin sade özeti.
 *
 * Uydurma "kişilik" etiketleri (Rock Ruhu, Gece Kuşu...) yerine yalnızca gerçek
 * veri gösterilir: kaç konser, hangi sanatçı, hangi türler, hangi ay. Konser
 * yoksa slogan yerine seçtiği türlerde yaklaşan konserler listelenir.
 */
export default function WrappedScreen({ navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t, tu, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locale = lang === 'en' ? 'en-US' : 'tr-TR';
  const year = new Date().getFullYear();

  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    API.get(`/users/${session.userId}/passport`)
      .then(res => setPassport(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const events = passport?.events || [];
  const hasData = events.length > 0;

  // Konser yoksa: seçtiği türlerde yaklaşan birkaç konser
  useEffect(() => {
    if (loading || hasData) return;
    const params = ['limit=4', 'upcoming=true'];
    if (session.userCity) params.push(`city=${encodeURIComponent(session.userCity)}`);
    if (session.favoriteGenres) params.push(`genres=${encodeURIComponent(session.favoriteGenres)}`);
    API.get(`/events?${params.join('&')}`)
      .then(res => setSuggestions(Array.isArray(res.data) ? res.data.slice(0, 4) : []))
      .catch(() => {});
  }, [loading, hasData]);

  const summary = useMemo(() => {
    const thisYear = events.filter(e => parseEventDate(e.eventDate).getFullYear() === year);
    const list = thisYear.length ? thisYear : events;

    const artistCounts = {};
    const artistEvent = {};
    const genreCounts = {};
    const monthCounts = {};
    list.forEach(e => {
      if (e.artistName) {
        artistCounts[e.artistName] = (artistCounts[e.artistName] || 0) + 1;
        if (!artistEvent[e.artistName]) artistEvent[e.artistName] = e;
      }
      if (e.genre) genreCounts[e.genre] = (genreCounts[e.genre] || 0) + 1;
      const m = parseEventDate(e.eventDate).getMonth();
      if (!isNaN(m)) monthCounts[m] = (monthCounts[m] || 0) + 1;
    });

    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0];
    const genreTotal = Object.values(genreCounts).reduce((s, c) => s + c, 0) || 1;
    const genres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([genre, count]) => ({ genre, count, percent: Math.round(count * 100 / genreTotal) }));
    const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
    const sorted = [...list].sort((a, b) => parseEventDate(b.eventDate) - parseEventDate(a.eventDate));
    const months = Array.from({ length: 12 }, (_, m) => monthCounts[m] || 0);
    const collage = [];
    sorted.forEach(e => { if (e.artistName && !collage.some(c => c.artistName === e.artistName)) collage.push(e); });

    return {
      isThisYear: thisYear.length > 0,
      concerts: list.length,
      // cityKey backend'den gelir: "Istanbul" ve "İstanbul" tek şehir
      cities: new Set(list.map(e => e.cityKey || e.venueCity).filter(Boolean)).size,
      artists: Object.keys(artistCounts).length,
      verified: list.filter(e => e.verified).length,
      topArtist: topArtist ? { name: topArtist[0], count: topArtist[1], event: artistEvent[topArtist[0]] } : null,
      genres,
      topMonth: topMonth
        ? { name: new Date(year, Number(topMonth[0]), 1).toLocaleDateString(locale, { month: 'long' }), count: topMonth[1] }
        : null,
      recent: sorted.slice(0, 8),
      months,
      collage: collage.slice(0, 5),
      topGenre: genres[0]?.genre || null,
    };
  }, [events, year, locale]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      {/* ÜST: büyük sayı, sade arka plan */}
      <LinearGradient
        colors={hasData ? [...getGenreGradient(summary.topGenre), colors.background] : ['#E94560', '#7C3AED', colors.background]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroRing1} />
        <View style={styles.heroRing2} />
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroLabel}>
          {summary.isThisYear || !hasData ? tu('wrapped_year_label', { year }) : tu('wrapped_all_time')}
        </Text>
        {hasData ? (
          <>
            <View style={styles.heroCountRow}>
              <Text style={styles.heroCount}>{summary.concerts}</Text>
              <Text style={styles.heroCountUnit}>{t('wrapped_unit_concerts')}</Text>
            </View>
            <View style={styles.heroStats}>
              <HeroStat icon="location-outline" value={summary.cities} label={t('wrapped_stat_cities')} styles={styles} colors={colors} />
              <HeroStat icon="mic-outline" value={summary.artists} label={t('wrapped_stat_artists')} styles={styles} colors={colors} />
              <HeroStat icon="checkmark-circle-outline" value={summary.verified} label={t('wrapped_stat_verified')} styles={styles} colors={colors} />
            </View>
            {summary.collage.length > 1 && (
              <View style={styles.collage}>
                {summary.collage.map((e, i) => (
                  <EventImage
                    key={e.id}
                    item={{ ...e, name: e.artistName, imageUrl: e.imageUrl }}
                    style={[styles.collagePhoto, { marginLeft: i === 0 ? 0 : -14, zIndex: 10 - i }]}
                    initialsSize={14}
                  />
                ))}
                <Text style={styles.collageText} numberOfLines={1}>
                  {summary.collage.map(e => e.artistName).slice(0, 2).join(', ')}
                  {summary.artists > 2 ? ` +${summary.artists - 2}` : ''}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.heroEmptyTitle}>{t('wrapped_hero_empty')}</Text>
            <Text style={styles.heroEmptySub}>{t('wrapped_empty_sub')}</Text>
          </>
        )}
      </LinearGradient>

      {hasData ? (
        <>
          {/* EN ÇOK GÖRDÜĞÜN SANATÇI */}
          {summary.topArtist && (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={summary.topArtist.event?.artistId ? 0.85 : 1}
              onPress={() => summary.topArtist.event?.artistId && navigation.navigate('ArtistProfile', {
                artistId: summary.topArtist.event.artistId, artistName: summary.topArtist.name,
              })}
            >
              <Text style={styles.cardLabel}>{tu('wrapped_top_artist')}</Text>
              <View style={styles.artistRow}>
                <EventImage
                  item={{ ...summary.topArtist.event, name: summary.topArtist.name, artistName: summary.topArtist.name }}
                  style={styles.artistPhoto}
                  initialsSize={22}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.artistName} numberOfLines={1}>{summary.topArtist.name}</Text>
                  <Text style={styles.cardSub}>{t('wrapped_top_artist_sub', { count: summary.topArtist.count })}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}

          {/* TÜRLER */}
          {summary.genres.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{tu('wrapped_genres')}</Text>
              {summary.genres.map(g => (
                <View key={g.genre} style={styles.genreRow}>
                  <Text style={styles.genreName} numberOfLines={1}>{g.genre}</Text>
                  <View style={styles.genreTrack}>
                    <LinearGradient
                      colors={getGenreGradient(g.genre)}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.genreFill, { width: `${Math.max(6, g.percent)}%` }]}
                    />
                  </View>
                  <Text style={styles.genreCount}>{g.count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* EN YOĞUN AY */}
          {summary.topMonth && summary.concerts > 1 && (
            <View style={styles.card}>
              <View style={styles.monthHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>{tu('wrapped_busy_month')}</Text>
                  <Text style={styles.monthName}>{summary.topMonth.name}</Text>
                </View>
                <Text style={styles.monthCount}>{t('wrapped_busy_month_sub', { count: summary.topMonth.count })}</Text>
              </View>
              <View style={styles.monthChart}>
                {summary.months.map((c, m) => {
                  const max = Math.max(...summary.months, 1);
                  const top = c === max && c > 0;
                  return (
                    <View key={m} style={styles.monthCol}>
                      <View style={[styles.monthBar, { height: 6 + (c / max) * 54 }, top ? styles.monthBarTop : c > 0 ? styles.monthBarOn : null]} />
                      <Text style={[styles.monthInitial, top && { color: colors.primary }]}>
                        {new Date(year, m, 1).toLocaleDateString(locale, { month: 'narrow' })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* GİTTİĞİN KONSERLER */}
          <Text style={styles.sectionTitle}>{t('wrapped_recent')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
            {summary.recent.map(e => (
              <EventCard
                key={e.id}
                item={e}
                variant="tile"
                style={styles.recentTile}
                onPress={() => openEvent(navigation, e.id)}
              />
            ))}
          </ScrollView>

          <TouchableOpacity onPress={() => navigation.navigate('ConcertPassport')} activeOpacity={0.85} style={styles.primaryBtn}>
            <Ionicons name="albums-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('wrapped_open_passport')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {suggestions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('wrapped_empty_title')}</Text>
              <View style={{ paddingHorizontal: 16 }}>
                {suggestions.map(e => (
                  <EventCard key={e.id} item={e} variant="row" onPress={() => openEvent(navigation, e.id)} />
                ))}
              </View>
            </>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('MainApp', { screen: 'Events' })}
            activeOpacity={0.85}
            style={styles.primaryBtn}
          >
            <Ionicons name="ticket-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('wrapped_browse_events')}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        onPress={() => navigation.navigate('GenreSelection', { editMode: true })}
        activeOpacity={0.8}
        style={styles.secondaryBtn}
      >
        <Ionicons name="options-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.secondaryBtnText}>{t('wrapped_edit_prefs')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function HeroStat({ icon, value, label, styles, colors }) {
  return (
    <View style={styles.heroStat}>
      <Ionicons name={icon} size={15} color="rgba(255,255,255,0.85)" />
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { justifyContent: 'center', alignItems: 'center' },

    hero: { paddingTop: 52, paddingBottom: 26, paddingHorizontal: 20, overflow: 'hidden' },
    heroRing1: {
      position: 'absolute', right: -70, top: 20, width: 240, height: 240, borderRadius: 120,
      borderWidth: 28, borderColor: 'rgba(255,255,255,0.07)',
    },
    heroRing2: {
      position: 'absolute', right: 10, top: 100, width: 80, height: 80, borderRadius: 40,
      borderWidth: 10, borderColor: 'rgba(255,255,255,0.06)',
    },
    backBtn: { alignSelf: 'flex-start', marginBottom: 14, marginLeft: -6 },
    heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '900', letterSpacing: 1.6, marginBottom: 6 },
    heroCountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    heroCount: { color: '#fff', fontSize: 84, lineHeight: 88, fontWeight: '900', letterSpacing: -3 },
    heroCountUnit: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 14 },
    heroStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
    heroStat: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    },
    heroStatValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
    heroStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', flexShrink: 1 },
    heroEmptyTitle: { color: '#fff', fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 4 },
    heroEmptySub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, marginTop: 6 },
    collage: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
    collagePhoto: { width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.9)' },
    collageText: { color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 10, flex: 1 },

    card: {
      marginHorizontal: 16, marginTop: 14, padding: 16,
      borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    },
    cardLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
    cardSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },

    artistRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    artistPhoto: { width: 60, height: 60, borderRadius: 30 },
    artistName: { color: colors.text, fontSize: 20, fontWeight: '900' },

    genreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
    genreName: { width: 92, color: colors.text, fontSize: 13.5, fontWeight: '700' },
    genreTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border },
    genreFill: { height: 8, borderRadius: 4 },
    genreCount: { width: 26, textAlign: 'right', color: colors.textSecondary, fontSize: 12.5, fontWeight: '800' },

    monthHead: { flexDirection: 'row', alignItems: 'flex-start' },
    monthChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, height: 80 },
    monthCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    monthBar: { width: 12, borderRadius: 6, backgroundColor: colors.border },
    monthBarOn: { backgroundColor: colors.primary + '70' },
    monthBarTop: { backgroundColor: colors.primary },
    monthInitial: { color: colors.textSecondary, fontSize: 10.5, fontWeight: '800', marginTop: 6 },
    monthName: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: -6, textTransform: 'capitalize' },
    monthCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },

    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 24, marginBottom: 12, paddingHorizontal: 20 },
    recentRow: { paddingHorizontal: 16, gap: 12 },
    recentTile: { width: 156 },

    primaryBtn: {
      marginHorizontal: 16, marginTop: 20, paddingVertical: 15, borderRadius: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.primary,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    secondaryBtn: {
      marginHorizontal: 16, marginTop: 10, paddingVertical: 13, borderRadius: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    secondaryBtnText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: '700' },
  });
}
