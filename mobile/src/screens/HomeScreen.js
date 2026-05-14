import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, TextInput,
  Dimensions, Animated, StatusBar, FlatList
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

const { width, height } = Dimensions.get('window');
const FEATURED_CARD_WIDTH = width * 0.78;
const FEATURED_CARD_HEIGHT = 240;

// Kategori → genre eşleşmesi
const categoryGenreMap = {
  'Konser': ['pop', 'rock', 'indie', 'alternative', 'classical', 'R&B', 'hip-hop', 'country', 'undefined'],
  'Festival': ['festival', 'world', 'folk'],
  'DJ': ['electronic', 'house', 'techno', 'dance', 'edm', 'dj'],
  'Caz': ['jazz', 'blues', 'soul', 'funk'],
  'Elektronik': ['electronic', 'house', 'techno', 'dance', 'edm', 'trance'],
};

const categories = [
  { id: 1, label: 'Tümü', emoji: '🎪', color: '#E94560' },
  { id: 2, label: 'Konser', emoji: '🎸', color: '#7C3AED' },
  { id: 3, label: 'Festival', emoji: '🎡', color: '#F5A623' },
  { id: 4, label: 'DJ', emoji: '🎧', color: '#00D4AA' },
  { id: 5, label: 'Caz', emoji: '🎺', color: '#E94560' },
  { id: 6, label: 'Elektronik', emoji: '🎛️', color: '#7C3AED' },
];

const accentColors = ['#E94560', '#7C3AED', '#F5A623', '#00D4AA', '#FF6B6B', '#4ECDC4'];

function matchesCategory(event, categoryLabel) {
  if (categoryLabel === 'Tümü') return true;
  const genres = categoryGenreMap[categoryLabel] || [];
  const eventGenre = (event.genre || '').toLowerCase();
  const eventName = (event.name || '').toLowerCase();
  return genres.some(g => eventGenre.includes(g) || eventName.includes(g));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('tr-TR', { day: 'numeric' });
  const month = d.toLocaleDateString('tr-TR', { month: 'short' });
  return { day, month };
}

// ── FEATURED CARD ──────────────────────────────────────────────────────────
function FeaturedCard({ item, index, onPress, styles }) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1, delay: index * 80,
        tension: 55, friction: 8, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, delay: index * 80,
        duration: 350, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const accent = accentColors[index % accentColors.length];
  const { day, month } = formatDate(item.eventDate);

  return (
    <Animated.View style={[styles.featuredCardOuter, { opacity, transform: [{ scale }] }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={() => onPress(item)}>
        <View style={styles.featuredCard}>
          {/* BG IMAGE OR GRADIENT */}
          {item.imageUrl || item.artistImageUrl ? (
            <Image
              source={{ uri: item.imageUrl || item.artistImageUrl }}
              style={styles.featuredBg}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={[accent + 'CC', '#0A0A14']}
              style={styles.featuredBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          {/* SCRIM */}
          <LinearGradient
            colors={['transparent', 'rgba(4,4,16,0.65)', 'rgba(4,4,16,0.97)']}
            style={styles.featuredScrim}
          />

          {/* DATE BADGE */}
          <View style={[styles.dateBadge, { backgroundColor: accent }]}>
            <Text style={styles.dateBadgeDay}>{day}</Text>
            <Text style={styles.dateBadgeMon}>{month}</Text>
          </View>

          {/* GENRE TAG */}
          {item.genre && (
            <View style={styles.genreTag}>
              <Text style={styles.genreTagText}>{item.genre}</Text>
            </View>
          )}

          {/* CONTENT */}
          <View style={styles.featuredContent}>
            {item.artistName && (
              <Text style={styles.featuredArtist} numberOfLines={1}>
                🎤 {item.artistName}
              </Text>
            )}
            <Text style={styles.featuredTitle} numberOfLines={2}>{item.name}</Text>
            <View style={styles.featuredMeta}>
              {item.venueCity && (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>📍 {item.venueCity}</Text>
                </View>
              )}
              <View style={[styles.metaPill, { borderColor: accent + '60', backgroundColor: accent + '18' }]}>
                <Text style={[styles.metaPillText, { color: accent }]}>
                  {item.isApproved ? '✓ Onaylı' : '⏳ Bekliyor'}
                </Text>
              </View>
            </View>
          </View>

          {/* ACCENT LINE */}
          <View style={[styles.featuredAccentLine, { backgroundColor: accent }]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── LIST ROW CARD ──────────────────────────────────────────────────────────
function EventRow({ item, index, onPress, styles }) {
  const translateX = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0, delay: index * 60,
        tension: 60, friction: 9, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, delay: index * 60,
        duration: 300, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const accent = accentColors[index % accentColors.length];
  const { day, month } = formatDate(item.eventDate);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <TouchableOpacity style={styles.eventRow} onPress={() => onPress(item)} activeOpacity={0.82}>
        {/* LEFT DATE */}
        <View style={[styles.eventRowDate, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
          <Text style={[styles.eventRowDay, { color: accent }]}>{day}</Text>
          <Text style={[styles.eventRowMon, { color: accent }]}>{month}</Text>
        </View>

        {/* THUMBNAIL */}
        <View style={styles.eventRowThumb}>
          {item.imageUrl || item.artistImageUrl ? (
            <Image
              source={{ uri: item.imageUrl || item.artistImageUrl }}
              style={styles.eventRowThumbImg}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={[accent + 'BB', accent + '44']}
              style={styles.eventRowThumbImg}
            >
              <Text style={{ fontSize: 22 }}>🎵</Text>
            </LinearGradient>
          )}
        </View>

        {/* INFO */}
        <View style={styles.eventRowInfo}>
          <Text style={styles.eventRowTitle} numberOfLines={1}>{item.name}</Text>
          {item.artistName && (
            <Text style={styles.eventRowArtist} numberOfLines={1}>🎤 {item.artistName}</Text>
          )}
          {item.venueCity && (
            <Text style={styles.eventRowVenue} numberOfLines={1}>📍 {item.venueCity}</Text>
          )}
        </View>

        {/* ARROW */}
        <View style={[styles.eventRowArrow, { backgroundColor: accent + '18' }]}>
          <Text style={{ color: accent, fontSize: 16, fontWeight: '700' }}>›</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── POST CARD ──────────────────────────────────────────────────────────────
function PostCard({ item, index, styles }) {
  const accent = accentColors[index % accentColors.length];

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.postCard}>
      {/* LEFT ACCENT */}
      <View style={[styles.postAccentBar, { backgroundColor: accent }]} />

      <View style={styles.postInner}>
        {/* HEADER */}
        <View style={styles.postHeader}>
          <View style={[styles.postAvatar, { backgroundColor: accent + '28', borderColor: accent + '50' }]}>
            <Text style={{ color: accent, fontWeight: '800', fontSize: 15 }}>
              {item.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postUsername}>@{item.username}</Text>
            <Text style={styles.postEvent} numberOfLines={1}>🎵 {item.eventName}</Text>
          </View>
          <Text style={styles.postTime}>{timeAgo(item.createdAt)}</Text>
        </View>

        {/* CONTENT */}
        <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>

        {/* FOOTER */}
        <View style={styles.postFooter}>
          <Text style={styles.postStat}>❤️ {item.likeCount ?? 0}</Text>
          <Text style={styles.postStat}>💬 {item.commentCount ?? 0}</Text>
          <View style={styles.postDot} />
        </View>
      </View>
    </View>
  );
}

// ── MAIN SCREEN ────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);

  const headerAnim = useRef(new Animated.Value(-20)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const searchWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {




    Animated.parallel([
      Animated.spring(headerAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true
      }),

      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }),
    ]).start();

    const city = global.userCity;
    const genres = global.favoriteGenres;

    let url = '/events';
    const params = [];
    if (city) params.push(`city=${encodeURIComponent(city)}`);
    if (genres) params.push(`genres=${encodeURIComponent(genres)}`);
    if (params.length) url += '?' + params.join('&');

    Promise.all([
      API.get(url),
      API.get('/posts/feed/trending'),
    ])
      .then(([evRes, postRes]) => {
        setEvents(evRes.data);
        setPosts(postRes.data);
      })
      .catch(err =>
        console.log('HomeScreen fetch error:', err.message)
      )
      .finally(() => setLoading(false));

  }, []);

  const activeCategoryLabel = categories.find(c => c.id === activeCategory)?.label || 'Tümü';
  const activeCategoryColor = categories.find(c => c.id === activeCategory)?.color || colors.primary;

  const filteredEvents = events.filter(e => {
    const matchSearch =
      !search.trim() ||
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.artistName?.toLowerCase().includes(search.toLowerCase()) ||
      e.venueCity?.toLowerCase().includes(search.toLowerCase());
    return matchSearch && matchesCategory(e, activeCategoryLabel);
  });

  const filteredPosts = posts.filter(p => {
    if (!search.trim()) return true;
    return (
      p.content?.toLowerCase().includes(search.toLowerCase()) ||
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.eventName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (loading) return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Yükleniyor...</Text>
    </View>
  );

  return (
    <View style={styles.screen}>



      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#0A0A14', '#12121E', '#0A0A14']}
          style={styles.header}
        >
          {/* TOP ROW */}
          <Animated.View
            style={[styles.headerTop, { opacity: headerOpacity, transform: [{ translateY: headerAnim }] }]}
          >
            <View>
              <Text style={styles.headerGreeting}>
                {global.userCity ? `📍 ${global.userCity}` : 'Merhaba 👋'}
              </Text>
              <Text style={styles.headerBrand}>Concertly</Text>
            </View>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.headerLogo}
              contentFit="contain"
            />
          </Animated.View>

          {/* SEARCH BAR */}
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Etkinlik, sanatçı, şehir ara..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* STATS ROW */}
          <View style={styles.statsStrip}>
            <View style={styles.statStripItem}>
              <Text style={styles.statStripNum}>{events.length}</Text>
              <Text style={styles.statStripLabel}>Etkinlik</Text>
            </View>
            <View style={styles.statStripDivider} />
            <View style={styles.statStripItem}>
              <Text style={styles.statStripNum}>{posts.length}</Text>
              <Text style={styles.statStripLabel}>Post</Text>
            </View>
            <View style={styles.statStripDivider} />
            <View style={styles.statStripItem}>
              <Text style={styles.statStripNum}>TR</Text>
              <Text style={styles.statStripLabel}>Bölge</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── KATEGORİLER ────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
          style={styles.categoriesScroll}
        >
          {categories.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.catChip,
                  active && { backgroundColor: cat.color + '22', borderColor: cat.color + '80' }
                ]}>
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catLabel, active && { color: cat.color }]}>{cat.label}</Text>
                  {active && <View style={[styles.catDot, { backgroundColor: cat.color }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── ÖNE ÇIKANLAR ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, { backgroundColor: activeCategoryColor }]} />
              <Text style={styles.sectionTitle}>Öne Çıkanlar</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Events')} style={styles.seeAllBtn}>
              <Text style={[styles.seeAllText, { color: activeCategoryColor }]}>Tümü →</Text>
            </TouchableOpacity>
          </View>

          {filteredEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎭</Text>
              <Text style={styles.emptyText}>Etkinlik bulunamadı</Text>
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
                  onPress={ev => navigation.navigate('EventDetail', { event: ev })}
                  styles={styles}
                />
              )}
            />
          )}
        </View>

        {/* ── YAKLAŞAN ETKİNLİKLER (LIST) ───────────────────────────── */}
        {filteredEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionAccent, { backgroundColor: colors.accent }]} />
                <Text style={styles.sectionTitle}>Yaklaşan Etkinlikler</Text>
              </View>
            </View>
            {filteredEvents.slice(0, 5).map((item, index) => (
              <EventRow
                key={`row-${item.id}`}
                item={item}
                index={index}
                onPress={ev => navigation.navigate('EventDetail', { event: ev })}
                styles={styles}
              />
            ))}
            {filteredEvents.length > 5 && (
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => navigation.navigate('Events')}
              >
                <Text style={styles.moreBtnText}>
                  +{filteredEvents.length - 5} etkinlik daha gör
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── TRENDING POSTLAR ───────────────────────────────────────── */}
        <View style={[styles.section, { paddingBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, { backgroundColor: colors.secondary }]} />
              <Text style={styles.sectionTitle}>🔥 Trend Postlar</Text>
            </View>
          </View>

          {filteredPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>Post bulunamadı</Text>
            </View>
          ) : (
            filteredPosts.slice(0, 6).map((item, index) => (
              <PostCard key={`post-${item.id}`} item={item} index={index} styles={styles} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────────
function createStyles(colors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // LOADING
  loadingScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, gap: 14,
  },
  loadingText: { color: colors.textSecondary, fontSize: 14 },

  // HEADER
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerGreeting: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerBrand: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerLogo: { width: 48, height: 48, borderRadius: 14 },

  // SEARCH
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  searchBarFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.cardAlt,
  },
  searchIcon: { fontSize: 18, color: colors.textSecondary },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  searchClear: { color: colors.textSecondary, fontSize: 15, padding: 2 },

  // STATS STRIP
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statStripItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
  },
  statStripNum: {
    fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2,
  },
  statStripLabel: {
    fontSize: 10, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  statStripDivider: {
    width: 1, backgroundColor: colors.border,
  },

  // CATEGORIES
  categoriesScroll: { marginTop: 4 },
  categoriesRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 2,
  },
  catEmoji: { fontSize: 15 },
  catLabel: {
    fontSize: 13, color: colors.textSecondary, fontWeight: '600',
  },
  catDot: {
    width: 5, height: 5, borderRadius: 2.5, marginLeft: 2,
  },

  // SECTIONS
  section: { paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionAccent: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: {
    fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: 0.2,
  },
  seeAllBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, backgroundColor: colors.cardAlt,
    borderWidth: 1, borderColor: colors.border,
  },
  seeAllText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

  // FEATURED
  featuredList: { paddingRight: 20, gap: 14, paddingBottom: 4 },
  featuredCardOuter: { width: FEATURED_CARD_WIDTH },
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    height: FEATURED_CARD_HEIGHT,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featuredBg: {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
  },
  featuredScrim: {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
  },
  dateBadge: {
    position: 'absolute', top: 14, left: 14,
    width: 42, height: 48, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dateBadgeDay: { fontSize: 18, fontWeight: '900', color: '#fff', lineHeight: 20 },
  dateBadgeMon: { fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'uppercase', opacity: 0.85 },
  genreTag: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  genreTagText: { color: '#fff', fontSize: 11, fontWeight: '600', opacity: 0.8 },
  featuredContent: {
    position: 'absolute', bottom: 14, left: 14, right: 14,
  },
  featuredArtist: {
    fontSize: 12, color: '#fff', opacity: 0.7,
    marginBottom: 4, fontWeight: '600',
  },
  featuredTitle: {
    fontSize: 18, fontWeight: '900', color: '#fff',
    lineHeight: 22, marginBottom: 10,
  },
  featuredMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  metaPillText: { fontSize: 11, color: '#fff', fontWeight: '600', opacity: 0.8 },
  featuredAccentLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
  },

  // EVENT ROW
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  eventRowDate: {
    width: 46, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  eventRowDay: { fontSize: 18, fontWeight: '900', lineHeight: 20, color: colors.text },
  eventRowMon: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.textSecondary },
  eventRowThumb: {
    width: 52, height: 52, borderRadius: 12, overflow: 'hidden',
  },
  eventRowThumbImg: {
    width: 52, height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  eventRowInfo: { flex: 1 },
  eventRowTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 3 },
  eventRowArtist: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  eventRowVenue: { fontSize: 12, color: colors.textSecondary },
  eventRowArrow: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // MORE BUTTON
  moreBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  moreBtnText: {
    color: colors.textSecondary, fontSize: 13, fontWeight: '700',
  },

  // POST CARD
  postCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  postAccentBar: { width: 3 },
  postInner: { flex: 1, padding: 14 },
  postHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 10,
  },
  postAvatar: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  postUsername: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 2 },
  postEvent: { fontSize: 11, color: colors.textSecondary },
  postTime: { fontSize: 11, color: colors.textSecondary },
  postContent: {
    fontSize: 14, color: colors.text,
    lineHeight: 20, marginBottom: 12, opacity: 0.75,
  },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  postStat: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  postDot: {
    marginLeft: 'auto', width: 6, height: 6,
    borderRadius: 3, backgroundColor: colors.border,
  },

  // EMPTY
  emptyState: { alignItems: 'center', paddingVertical: 36 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});
}