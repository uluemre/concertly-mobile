import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView, Dimensions,
  Animated, StatusBar, FlatList, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import API, { getErrorMessage } from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { HomeSkeletonPage } from '../components/SkeletonLoader';
import SearchModal from './SearchModal';
import FeaturedCard from '../components/home/FeaturedCard';
import HomePostCard from '../components/home/HomePostCard';

const { width } = Dimensions.get('window');
const FEATURED_CARD_WIDTH = width * 0.78;
const FEATURED_CARD_HEIGHT = 240;

const CITIES = ['Tümü', 'Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Mersin', 'Eskisehir'];

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();

  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState(session.userCity || null);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [daily, setDaily] = useState(null);
  const [followedArtistIds, setFollowedArtistIds] = useState(() => new Set());

  const headerAnim = useRef(new Animated.Value(-20)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // Günlük şarkı durumu — ekran odaktayken güncelle
  useFocusEffect(useCallback(() => {
    API.get('/daily-song/today').then(res => setDaily(res.data)).catch(() => {});
  }, []));

  // Takip edilen sanatçılar — ekranlara dönünce tazelenir (best-effort)
  useFocusEffect(useCallback(() => {
    if (!session.userId) return;
    API.get(`/users/${session.userId}/followed-artists`)
      .then(res => setFollowedArtistIds(new Set((res.data || []).map(a => a.id))))
      .catch(() => {});
  }, [session.userId]));

  // Okunmamış mesaj sayısı — ekran odaktayken periyodik tazelenir
  useFocusEffect(useCallback(() => {
    const fetchUnread = async () => {
      try {
        const res = await API.get('/messages/unread-count');
        if (isMounted.current) setUnreadMessages(res.data.count ?? 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, []));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    fetchData();
  }, []);

  const fetchData = (city) => {
    const activeCity = city !== undefined ? city : selectedCity;
    const genres = session.favoriteGenres;
    let url = '/events';
    // Ana sayfa en fazla 6 öne çıkan gösteriyor — tüm listeyi (≈1MB) indirmeye gerek yok.
    // upcoming=true: geçmiş etkinlikler limit'i doldurup gelecekteki konserleri gizlemesin (4.3)
    const params = ['limit=40', 'upcoming=true'];
    if (activeCity) params.push(`city=${encodeURIComponent(activeCity)}`);
    if (genres) params.push(`genres=${encodeURIComponent(genres)}`);
    url += '?' + params.join('&');

    setLoading(true);
    Promise.all([API.get(url), API.get('/posts/feed/trending')])
      .then(([evRes, postRes]) => {
        if (!isMounted.current) return;
        setEvents(evRes.data);
        setPosts(postRes.data);
        setError(null);
      })
      .catch(err => { if (isMounted.current) setError(getErrorMessage(err)); })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });
  };

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setCityModalVisible(false);
    fetchData(city);
  };

  const filteredEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const q = search.trim().toLowerCase();
    const list = events.filter(e => {
      if (new Date(e.eventDate) < today) return false;
      return !q ||
        e.name?.toLowerCase().includes(q) ||
        e.artistName?.toLowerCase().includes(q) ||
        e.venueCity?.toLowerCase().includes(q);
    });
    // Takip edilen sanatçıların etkinliklerini öne al (stabil sıralama)
    if (followedArtistIds.size > 0) {
      list.sort((a, b) =>
        (followedArtistIds.has(b.artistId) ? 1 : 0) - (followedArtistIds.has(a.artistId) ? 1 : 0));
    }
    return list;
  }, [events, search, followedArtistIds]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(p =>
      p.content?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q) ||
      p.eventName?.toLowerCase().includes(q)
    );
  }, [posts, search]);

  const handleNavigateToEvent = useCallback(
    ev => navigation.navigate('EventDetail', { event: ev }),
    [navigation]
  );

  if (loading) return (
    <View style={styles.skeletonScreen}>
      <HomeSkeletonPage />
    </View>
  );

  if (error && events.length === 0 && posts.length === 0) return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorEmoji}>📡</Text>
      <Text style={styles.errorTitle}>{t('load_failed')}</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity onPress={() => fetchData()} activeOpacity={0.85} style={styles.retryBtn}>
        <Text style={styles.retryBtnText}>{t('retry')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <SearchModal visible={searchModalVisible} onClose={() => setSearchModalVisible(false)} navigation={navigation} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* HEADER */}
        <LinearGradient colors={['#0A0A14', '#12121E', '#0A0A14']} style={styles.header}>
          <Animated.View style={[styles.headerTop, { opacity: headerOpacity, transform: [{ translateY: headerAnim }] }]}>
            <View>
              <Text style={styles.headerBrand}>Concertly</Text>
              <TouchableOpacity
                onPress={() => setCityModalVisible(true)}
                style={styles.cityRow}
                activeOpacity={0.7}
              >
                <Text style={styles.cityRowText}>📍 {selectedCity || t('home_all_turkey')}</Text>
                <Text style={styles.cityRowChevron}>▾</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.dmBtn}
              onPress={() => navigation.navigate('ChatList')}
              activeOpacity={0.8}
            >
              <Text style={styles.dmBtnIcon}>💬</Text>
              {unreadMessages > 0 && (
                <View style={styles.dmBadge}>
                  <Text style={styles.dmBadgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => setSearchModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.searchPlaceholder}>{t('home_search_placeholder')}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ÖNE ÇIKANLAR */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, { backgroundColor: colors.primary }]} />
              <Text style={styles.sectionTitle}>{t('home_featured')}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Events')} style={styles.seeAllBtn}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('home_see_all_btn')}</Text>
            </TouchableOpacity>
          </View>
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎭</Text>
              <Text style={styles.emptyText}>{t('home_no_events')}</Text>
            </View>
          ) : (
            <FlatList
              horizontal
              data={filteredEvents.slice(0, 6)}
              keyExtractor={item => `feat-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              snapToInterval={FEATURED_CARD_WIDTH + 14}
              decelerationRate="fast"
              renderItem={({ item, index }) => (
                <FeaturedCard
                  item={item}
                  index={index}
                  cardWidth={FEATURED_CARD_WIDTH}
                  cardHeight={FEATURED_CARD_HEIGHT}
                  onPress={handleNavigateToEvent}
                  followed={followedArtistIds.has(item.artistId)}
                />
              )}
            />
          )}
        </View>

        {/* GÜNLÜK ŞARKI WIDGET */}
        <TouchableOpacity
          onPress={() => navigation.navigate('DailySong')}
          activeOpacity={0.85}
          style={styles.dailyWidget}
        >
          <LinearGradient
            colors={daily?.finished
              ? (daily?.solved ? ['#00897B', '#00D4AA'] : ['#7f1d1d', '#E94560'])
              : ['#1a0a2e', '#2d1b69']}
            style={styles.dailyWidgetGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <View style={styles.dailyLeft}>
              <Text style={styles.dailyEmoji}>
                {daily?.finished ? (daily?.solved ? '✅' : '❌') : '🎵'}
              </Text>
              <View>
                <Text style={styles.dailyLabel}>{t('menu_daily_song')}</Text>
                <Text style={styles.dailyStatus}>
                  {!daily && t('games_daily_waiting')}
                  {daily?.finished && daily?.solved && (daily.streak > 0 ? t('games_daily_streak_safe', { count: daily.streak }) : t('games_daily_done'))}
                  {daily?.finished && !daily?.solved && t('games_daily_missed')}
                  {daily && !daily.finished && (daily.streak > 0 ? t('games_daily_keep_streak', { count: daily.streak }) : t('games_daily_waiting'))}
                </Text>
              </View>
            </View>
            <View style={styles.dailyRight}>
              {daily?.streak > 0 && (
                <View style={styles.dailyStreak}>
                  <Text style={styles.dailyStreakText}>🔥 {daily.streak}</Text>
                </View>
              )}
              {!daily?.finished && (
                <Text style={styles.dailyPlayBtn}>{t('bingo_start') ? '▶ Oyna' : '▶ Oyna'}</Text>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* TRENDING POSTLAR */}
        <View style={[styles.section, { paddingBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, { backgroundColor: colors.secondary }]} />
              <Text style={styles.sectionTitle}>{t('home_trend_posts')}</Text>
            </View>
          </View>
          {filteredPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>{t('home_no_posts')}</Text>
              <TouchableOpacity style={styles.moreBtn} onPress={() => navigation.navigate('FeedTab')}>
                <Text style={styles.moreBtnText}>{t('home_see_all_posts')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {filteredPosts.slice(0, 4).map((item, index) => (
                <HomePostCard key={`post-${item.id}`} item={item} index={index} navigation={navigation} />
              ))}
              <TouchableOpacity style={styles.moreBtn} onPress={() => navigation.navigate('FeedTab')}>
                <Text style={styles.moreBtnText}>{t('home_see_all_posts')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

      </ScrollView>

      {/* ŞEHİR MODAL */}
      <Modal visible={cityModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCityModalVisible(false)} />
        <View style={[styles.cityModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cityModalTitle, { color: colors.text }]}>{t('home_city_select')}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {CITIES.map(city => {
              const active = city === 'Tümü' ? !selectedCity : selectedCity === city;
              return (
                <TouchableOpacity
                  key={city}
                  onPress={() => handleCitySelect(city === 'Tümü' ? null : city)}
                  style={[styles.cityOption, active && { backgroundColor: colors.primary + '22' }]}
                >
                  <Text style={[styles.cityOptionText, { color: active ? colors.primary : colors.text }]}>
                    {city === 'Tümü' ? t('home_all_turkey') : `📍 ${city}`}
                  </Text>
                  {active && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 24 },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 14 },
    skeletonScreen: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
    errorScreen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    errorEmoji: { fontSize: 52, marginBottom: 14 },
    errorTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 8 },
    errorText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
    retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    loadingText: { color: colors.textSecondary, fontSize: 14 },
    header: { paddingTop: 60, paddingBottom: 22, paddingHorizontal: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerBrand: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
    cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start' },
    cityRowText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    cityRowChevron: { fontSize: 11, color: colors.textSecondary },
    dmBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    dmBtnIcon: { fontSize: 19 },
    dmBadge: {
      position: 'absolute', top: -4, right: -4,
      minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: '#E94560', paddingHorizontal: 4,
      justifyContent: 'center', alignItems: 'center',
    },
    dmBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, gap: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    searchIcon: { fontSize: 18, color: colors.textSecondary },
    searchPlaceholder: { flex: 1, color: colors.textSecondary, fontSize: 15 },
    section: { paddingHorizontal: 20, marginTop: 18, marginBottom: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionAccent: { width: 4, height: 18, borderRadius: 2 },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
    seeAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
    seeAllText: { fontSize: 13, fontWeight: '700' },
    featuredList: { paddingRight: 20, gap: 14, paddingBottom: 4 },
    moreBtn: { marginTop: 4, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    moreBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    dailyWidget: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 16, overflow: 'hidden' },
    dailyWidgetGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    dailyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    dailyEmoji: { fontSize: 28 },
    dailyLabel: { color: '#fff', fontSize: 14, fontWeight: '800' },
    dailyStatus: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
    dailyRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dailyStreak: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    dailyStreakText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    dailyPlayBtn: { color: '#fff', fontSize: 13, fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    emptyState: { alignItems: 'center', paddingVertical: 36 },
    emptyEmoji: { fontSize: 44, marginBottom: 10 },
    emptyText: { color: colors.textSecondary, fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    cityModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 40, maxHeight: '60%' },
    cityModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    cityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
    cityOptionText: { fontSize: 15 },
  });
}
