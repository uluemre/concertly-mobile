import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Dimensions,
  Animated, StatusBar, FlatList, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { HomeSkeletonPage } from '../components/SkeletonLoader';
import SearchModal from './SearchModal';
import FeaturedCard from '../components/home/FeaturedCard';
import EventRow from '../components/home/EventRow';
import HomePostCard from '../components/home/HomePostCard';

const { width } = Dimensions.get('window');
const FEATURED_CARD_WIDTH = width * 0.78;
const FEATURED_CARD_HEIGHT = 240;

const CATEGORY_GENRE_MAP = {
  Konser: ['pop', 'rock', 'indie', 'alternative', 'classical', 'R&B', 'hip-hop', 'country', 'undefined'],
  Festival: ['festival', 'world', 'folk'],
  DJ: ['electronic', 'house', 'techno', 'dance', 'edm', 'dj'],
  Caz: ['jazz', 'blues', 'soul', 'funk'],
  Elektronik: ['electronic', 'house', 'techno', 'dance', 'edm', 'trance'],
};

const CATEGORY_KEYS = [
  { id: 1, key: 'cat_all',       genreKey: null,       emoji: '🎪', color: '#E94560' },
  { id: 2, key: 'cat_concert',   genreKey: 'Konser',   emoji: '🎸', color: '#7C3AED' },
  { id: 3, key: 'cat_festival',  genreKey: 'Festival', emoji: '🎡', color: '#F5A623' },
  { id: 4, key: 'cat_dj',        genreKey: 'DJ',       emoji: '🎧', color: '#00D4AA' },
  { id: 5, key: 'cat_jazz',      genreKey: 'Caz',      emoji: '🎺', color: '#E94560' },
  { id: 6, key: 'cat_electronic',genreKey: 'Elektronik',emoji: '🎛️',color: '#7C3AED' },
];

const CITIES = ['Tümü', 'Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Mersin', 'Eskisehir'];

function matchesCategory(event, label) {
  if (!label) return true;
  const genres = CATEGORY_GENRE_MAP[label] || [];
  const eg = (event.genre || '').toLowerCase();
  const en = (event.name || '').toLowerCase();
  return genres.some(g => eg.includes(g) || en.includes(g));
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();

  const CATEGORIES = useMemo(() => CATEGORY_KEYS.map(c => ({ ...c, label: t(c.key) })), [t]);

  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(1);
  const [selectedCity, setSelectedCity] = useState(session.userCity || null);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const headerAnim = useRef(new Animated.Value(-20)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

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
    const params = [];
    if (activeCity) params.push(`city=${encodeURIComponent(activeCity)}`);
    if (genres) params.push(`genres=${encodeURIComponent(genres)}`);
    if (params.length) url += '?' + params.join('&');

    setLoading(true);
    Promise.all([API.get(url), API.get('/posts/feed/trending')])
      .then(([evRes, postRes]) => {
        if (!isMounted.current) return;
        setEvents(evRes.data);
        setPosts(postRes.data);
      })
      .catch(err => { if (isMounted.current) console.log('HomeScreen fetch error:', err.message); })
      .finally(() => {
        // En az 600ms skeleton göster ki animasyon görünsün
        setTimeout(() => { if (isMounted.current) setLoading(false); }, 600);
      });
  };

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setCityModalVisible(false);
    fetchData(city);
  };

  const activeCategoryLabel = useMemo(
    () => CATEGORIES.find(c => c.id === activeCategory)?.genreKey || null,
    [activeCategory, CATEGORIES]
  );
  const activeCategoryColor = useMemo(
    () => CATEGORIES.find(c => c.id === activeCategory)?.color || colors.primary,
    [activeCategory, colors.primary]
  );

  const filteredEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const q = search.trim().toLowerCase();
    return events.filter(e => {
      if (new Date(e.eventDate) < today) return false;
      const matchSearch = !q ||
        e.name?.toLowerCase().includes(q) ||
        e.artistName?.toLowerCase().includes(q) ||
        e.venueCity?.toLowerCase().includes(q);
      return matchSearch && matchesCategory(e, activeCategoryLabel);
    });
  }, [events, search, activeCategoryLabel]);

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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <SearchModal visible={searchModalVisible} onClose={() => setSearchModalVisible(false)} navigation={navigation} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* HEADER */}
        <LinearGradient colors={['#0A0A14', '#12121E', '#0A0A14']} style={styles.header}>
          <Animated.View style={[styles.headerTop, { opacity: headerOpacity, transform: [{ translateY: headerAnim }] }]}>
            <View>
              <Text style={styles.headerGreeting}>{session.userCity ? `📍 ${session.userCity}` : t('home_greeting')}</Text>
              <Text style={styles.headerBrand}>Concertly</Text>
            </View>
            <View style={styles.headerRight}>
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
              <Image source={require('../../assets/icon.png')} style={styles.headerLogo} contentFit="contain" />
            </View>
          </Animated.View>

          <View style={styles.searchRow}>
            <TouchableOpacity
              style={[styles.searchBar, styles.searchBarTappable]}
              onPress={() => setSearchModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.searchIcon}>⌕</Text>
              <Text style={styles.searchPlaceholder}>{t('home_search_placeholder')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCityModalVisible(true)} style={styles.cityBtn} activeOpacity={0.8}>
              <Text style={styles.cityBtnIcon}>📍</Text>
              <Text style={styles.cityBtnText} numberOfLines={1}>{selectedCity || t('cat_all')}</Text>
              <Text style={styles.cityBtnChevron}>▾</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsStrip}>
            <View style={styles.statStripItem}>
              <Text style={styles.statStripNum}>{events.length}</Text>
              <Text style={styles.statStripLabel}>{t('home_stat_events')}</Text>
            </View>
            <View style={styles.statStripDivider} />
            <View style={styles.statStripItem}>
              <Text style={styles.statStripNum}>{posts.length}</Text>
              <Text style={styles.statStripLabel}>{t('home_stat_posts')}</Text>
            </View>
            <View style={styles.statStripDivider} />
            <View style={styles.statStripItem}>
              <Text style={styles.statStripNum}>TR</Text>
              <Text style={styles.statStripLabel}>{t('home_stat_region')}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* KATEGORİLER */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow} style={styles.categoriesScroll}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity key={cat.id} onPress={() => setActiveCategory(cat.id)} activeOpacity={0.8}>
                <View style={[styles.catChip, active && { backgroundColor: cat.color + '22', borderColor: cat.color + '80' }]}>
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catLabel, active && { color: cat.color }]}>{cat.label}</Text>
                  {active && <View style={[styles.catDot, { backgroundColor: cat.color }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ÖNE ÇIKANLAR */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, { backgroundColor: activeCategoryColor }]} />
              <Text style={styles.sectionTitle}>{t('home_featured')}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Events')} style={styles.seeAllBtn}>
              <Text style={[styles.seeAllText, { color: activeCategoryColor }]}>{t('home_see_all_btn')}</Text>
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
              data={filteredEvents.slice(0, 8)}
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
                />
              )}
            />
          )}
        </View>

        {/* YAKLAŞAN ETKİNLİKLER */}
        {filteredEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionAccent, { backgroundColor: colors.accent }]} />
                <Text style={styles.sectionTitle}>{t('home_upcoming_events')}</Text>
              </View>
            </View>
            {filteredEvents.slice(0, 5).map((item, index) => (
              <EventRow key={`row-${item.id}`} item={item} index={index} onPress={handleNavigateToEvent} />
            ))}
            {filteredEvents.length > 5 && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => navigation.navigate('Events')}>
                <Text style={styles.moreBtnText}>{t('home_more_events', { count: filteredEvents.length - 5 })}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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
            </View>
          ) : (
            filteredPosts.slice(0, 6).map((item, index) => (
              <HomePostCard key={`post-${item.id}`} item={item} index={index} navigation={navigation} />
            ))
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
    loadingText: { color: colors.textSecondary, fontSize: 14 },
    header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
    headerGreeting: { fontSize: 12, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    headerBrand: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
    headerLogo: { width: 48, height: 48, borderRadius: 14 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    cityBtn: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.primary + '60', borderRadius: 14,
      paddingHorizontal: 10, paddingVertical: 10, gap: 4, minWidth: 80,
    },
    cityBtnIcon: { fontSize: 13 },
    cityBtnText: { color: colors.primary, fontSize: 11, fontWeight: '700', maxWidth: 55 },
    cityBtnChevron: { color: colors.primary, fontSize: 10 },
    searchBar: {
      flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
      borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, gap: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    searchBarTappable: { borderColor: colors.border },
    searchIcon: { fontSize: 18, color: colors.textSecondary },
    searchPlaceholder: { flex: 1, color: colors.textSecondary, fontSize: 15 },
    statsStrip: {
      flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    statStripItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    statStripNum: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2 },
    statStripLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
    statStripDivider: { width: 1, backgroundColor: colors.border },
    categoriesScroll: { marginTop: 4 },
    categoriesRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
    catChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: 2,
    },
    catEmoji: { fontSize: 15 },
    catLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    catDot: { width: 5, height: 5, borderRadius: 2.5, marginLeft: 2 },
    section: { paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionAccent: { width: 4, height: 18, borderRadius: 2 },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
    seeAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
    seeAllText: { fontSize: 13, fontWeight: '700' },
    featuredList: { paddingRight: 20, gap: 14, paddingBottom: 4 },
    moreBtn: { marginTop: 4, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    moreBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
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
