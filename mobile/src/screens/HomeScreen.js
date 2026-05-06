import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl, ScrollView,
  TextInput, Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

const { width } = Dimensions.get('window');

const gradientSets = [
  ['#E94560', '#7C3AED'],
  ['#F5A623', '#E94560'],
  ['#00D4AA', '#7C3AED'],
  ['#7C3AED', '#F5A623'],
];

// Kategori → genre eşleşmesi
const categoryGenreMap = {
  'Konser': ['pop', 'rock', 'indie', 'alternative', 'classical', 'R&B', 'hip-hop', 'country', 'undefined'],
  'Festival': ['festival', 'world', 'folk'],
  'DJ': ['electronic', 'house', 'techno', 'dance', 'edm', 'dj'],
  'Caz': ['jazz', 'blues', 'soul', 'funk'],
  'Elektronik': ['electronic', 'house', 'techno', 'dance', 'edm', 'trance'],
};

const categories = [
  { id: 1, label: 'Tümü', emoji: '🎪' },
  { id: 2, label: 'Konser', emoji: '🎸' },
  { id: 3, label: 'Festival', emoji: '🎡' },
  { id: 4, label: 'DJ', emoji: '🎧' },
  { id: 5, label: 'Caz', emoji: '🎺' },
  { id: 6, label: 'Elektronik', emoji: '🎛️' },
];

const eventEmojis = ['🎸', '🎤', '🥁', '🎹', '🎺', '🎻', '🎪', '🎭'];

// Bir etkinlik kategoriye uyuyor mu?
function matchesCategory(event, categoryLabel) {
  if (categoryLabel === 'Tümü') return true;
  const genres = categoryGenreMap[categoryLabel] || [];
  const eventGenre = (event.genre || '').toLowerCase();
  const eventName = (event.name || '').toLowerCase();
  return genres.some(g => eventGenre.includes(g) || eventName.includes(g));
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(1);

  const fetchEvents = () => {
    const city = global.userCity;
    const url = city ? `/events?city=${encodeURIComponent(city)}` : '/events';
    return API.get(url)
      .then(res => setEvents(res.data))
      .catch(err => console.log('Events hatası:', err.message));
  };

  const fetchPosts = () =>
    API.get('/posts/feed/trending')
      .then(res => setPosts(res.data))
      .catch(err => console.log('Post hatası:', err.message));

  useEffect(() => {
    Promise.all([fetchEvents(), fetchPosts()]).finally(() => setLoading(false));
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchEvents(), fetchPosts()]).finally(() => setRefreshing(false));
  };

  // Aktif kategorinin label'ı
  const activeCategoryLabel = categories.find(c => c.id === activeCategory)?.label || 'Tümü';

  // Arama + kategori filtresi — event'lere uygulanır
  const filteredEvents = events.filter(e => {
    const matchSearch =
      !search.trim() ||
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.artistName?.toLowerCase().includes(search.toLowerCase()) ||
      e.venueCity?.toLowerCase().includes(search.toLowerCase());

    const matchCat = matchesCategory(e, activeCategoryLabel);
    return matchSearch && matchCat;
  });

  // Arama — post'lara da uygulanır
  const filteredPosts = posts.filter(p => {
    if (!search.trim()) return true;
    return (
      p.content?.toLowerCase().includes(search.toLowerCase()) ||
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.eventName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <LinearGradient colors={['#1E1B4B', '#09090B']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreeting}>Merhaba 👋</Text>
            <Text style={styles.headerTitle}>Concertly</Text>
          </View>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>

        {/* ARAMA */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Etkinlik, sanatçı, şehir veya post ara..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── KATEGORİLER ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={styles.categoryWrapper}
            >
              {activeCategory === cat.id ? (
                <LinearGradient
                  colors={['#E94560', '#7C3AED']}
                  style={styles.categoryActive}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={styles.categoryLabelActive}>{cat.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.categoryInactive}>
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={styles.categoryLabel}>{cat.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── ÖNE ÇIKANLAR ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔥 Öne Çıkanlar</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Events')}>
            <Text style={styles.seeAll}>Tümünü gör →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {filteredEvents.slice(0, 6).map((item, index) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => navigation.navigate('EventDetail', { event: item })}
              activeOpacity={0.85}
            >
              {item.imageUrl || item.artistImageUrl ? (
                // ── Fotoğraflı kart ──────────────────────────────────────
                <View style={styles.featuredImageWrapper}>
                  <Image
                    source={{ uri: item.imageUrl || item.artistImageUrl }}
                    style={styles.featuredImage}
                    contentFit="cover"
                    placeholder={require('../../assets/icon.png')}
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                  {/* Gradient overlay görsel üzerinde */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.78)']}
                    style={styles.featuredImageOverlay}
                  >
                    <Text style={styles.featuredName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.genre && (
                      <Text style={styles.genreChip}>🎵 {item.genre}</Text>
                    )}
                    {item.artistName && (
                      <Text style={styles.featuredArtist} numberOfLines={1}>
                        🎤 {item.artistName}
                      </Text>
                    )}
                    <View style={styles.featuredFooter}>
                      <Text style={styles.featuredDate}>
                        📅 {new Date(item.eventDate).toLocaleDateString('tr-TR', {
                          day: 'numeric', month: 'short',
                        })}
                      </Text>
                      {item.venueCity && (
                        <Text style={styles.featuredCity}>📍 {item.venueCity}</Text>
                      )}
                    </View>
                  </LinearGradient>
                </View>
              ) : (
                // ── Gradient kart ─────────────────────────────────────────
                <LinearGradient
                  colors={gradientSets[index % gradientSets.length]}
                  style={styles.featuredCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.featuredEmoji}>
                    {eventEmojis[index % eventEmojis.length]}
                  </Text>
                  <Text style={styles.featuredName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.genre && (
                    <Text style={styles.genreChip}>🎵 {item.genre}</Text>
                  )}
                  {item.artistName && (
                    <Text style={styles.featuredArtist} numberOfLines={1}>
                      🎤 {item.artistName}
                    </Text>
                  )}
                  <View style={styles.featuredFooter}>
                    <Text style={styles.featuredDate}>
                      📅 {new Date(item.eventDate).toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'short',
                      })}
                    </Text>
                    {item.venueCity && (
                      <Text style={styles.featuredCity}>📍 {item.venueCity}</Text>
                    )}
                  </View>
                </LinearGradient>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filteredEvents.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyText}>
              {search ? `"${search}" için sonuç bulunamadı` : 'Bu kategoride etkinlik yok'}
            </Text>
          </View>
        )}
      </View>

      {/* ── TÜM ETKİNLİKLER ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📋 Tüm Etkinlikler</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Events')}>
            <Text style={styles.seeAll}>Tümünü gör →</Text>
          </TouchableOpacity>
        </View>

        {filteredEvents.slice(0, 3).map((item, index) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => navigation.navigate('EventDetail', { event: item })}
            activeOpacity={0.85}
            style={styles.listCard}
          >
            <LinearGradient
              colors={gradientSets[index % gradientSets.length]}
              style={styles.listCardLeft}
            >
              <Text style={styles.listCardEmoji}>
                {eventEmojis[index % eventEmojis.length]}
              </Text>
            </LinearGradient>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardName} numberOfLines={1}>{item.name}</Text>
              {item.artistName && (
                <Text style={styles.listCardSub}>🎤 {item.artistName}</Text>
              )}
              <Text style={styles.listCardSub}>
                📅 {new Date(item.eventDate).toLocaleDateString('tr-TR')}
                {item.venueCity ? ` · 📍 ${item.venueCity}` : ''}
              </Text>
            </View>
            <Text style={styles.listCardArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {filteredEvents.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
          </View>
        )}
      </View>

      {/* ── TRENDING POSTLAR ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔥 Trending Postlar</Text>
          {search.length > 0 && (
            <Text style={styles.searchResultCount}>
              {filteredPosts.length} sonuç
            </Text>
          )}
        </View>

        {filteredPosts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>
              {search ? `"${search}" için post bulunamadı` : 'Henüz post yok'}
            </Text>
          </View>
        ) : (
          filteredPosts.map((post, index) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <LinearGradient
                  colors={gradientSets[index % gradientSets.length]}
                  style={styles.postAvatar}
                >
                  <Text style={styles.postAvatarText}>
                    {post.username?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </LinearGradient>
                <View style={styles.postHeaderInfo}>
                  <Text style={styles.postUsername}>@{post.username}</Text>
                  <Text style={styles.postEvent}>🎵 {post.eventName}</Text>
                </View>
              </View>
              <Text style={styles.postContent}>{post.content}</Text>
              <View style={styles.postFooter}>
                {/* likeCount ve commentCount backend'den geldiği gibi göster */}
                <Text style={styles.postStat}>
                  ❤️ {post.likeCount ?? 0}
                </Text>
                <Text style={styles.postStat}>
                  💬 {post.commentCount ?? 0}
                </Text>
                <Text style={styles.postDate}>
                  {new Date(post.createdAt).toLocaleDateString('tr-TR')}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: {
      flex: 1, justifyContent: 'center',
      alignItems: 'center', backgroundColor: colors.background,
    },

    // HEADER
    header: { paddingTop: 64, paddingBottom: 24, paddingHorizontal: 24 },
    headerTop: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 20,
    },
    headerGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 },
    headerTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
    headerLogo: { width: 52, height: 52 },

    // ARAMA
    searchBox: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, gap: 10,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    searchIcon: { fontSize: 16 },
    searchInput: { flex: 1, color: '#fff', fontSize: 15 },
    searchClear: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },

    // BÖLÜMLER
    section: { marginTop: 28, paddingHorizontal: 24 },
    sectionHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 16,
    },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
    seeAll: { fontSize: 13, color: '#E94560', fontWeight: '700' },
    searchResultCount: { fontSize: 13, color: colors.textSecondary },

    // KATEGORİLER
    categoriesList: { gap: 10, paddingBottom: 6 },
    categoryWrapper: { marginRight: 4 },
    categoryActive: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 22, gap: 6,
    },
    categoryInactive: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 6,
    },
    categoryEmoji: { fontSize: 16 },
    categoryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
    categoryLabelActive: { fontSize: 13, color: '#fff', fontWeight: '700' },

    // ÖNE ÇIKANLAR
    horizontalList: { gap: 14, paddingBottom: 4 },

    // Fotoğraflı kart — overlay düzeltildi
    featuredImageWrapper: {
      width: 200,
      height: 160,
      borderRadius: 18,
      overflow: 'hidden',
    },
    featuredImage: {
      width: 200,
      height: 160,
    },
    featuredImageOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 12,
      paddingTop: 24,
    },

    // Gradient kart
    featuredCard: {
      width: 200, height: 160,
      borderRadius: 18, padding: 16,
      justifyContent: 'space-between',
    },
    featuredEmoji: { fontSize: 32 },
    featuredName: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
    genreChip: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    featuredArtist: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    featuredFooter: { gap: 2, marginTop: 4 },
    featuredDate: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
    featuredCity: { fontSize: 11, color: 'rgba(255,255,255,0.9)' },

    // LİSTE KARTI
    listCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 16, marginBottom: 12,
      overflow: 'hidden',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    listCardLeft: { width: 68, height: 68, justifyContent: 'center', alignItems: 'center' },
    listCardEmoji: { fontSize: 28 },
    listCardRight: { flex: 1, padding: 12, gap: 4 },
    listCardName: { fontSize: 15, fontWeight: 'bold', color: colors.text, letterSpacing: 0.3 },
    listCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
    listCardArrow: { fontSize: 24, color: 'rgba(255,255,255,0.3)', paddingRight: 16 },

    // POST KARTI
    postCard: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 18, padding: 20, marginBottom: 14,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    postHeader: {
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 12, gap: 10,
    },
    postAvatar: {
      width: 40, height: 40, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center',
    },
    postAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    postHeaderInfo: { flex: 1 },
    postUsername: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
    postEvent: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    postContent: {
      fontSize: 14, color: colors.text,
      lineHeight: 20, marginBottom: 12,
    },
    postFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    postStat: { color: colors.textSecondary, fontSize: 13 },
    postDate: { color: colors.textSecondary, fontSize: 12, marginLeft: 'auto' },

    // BOŞ
    empty: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
  });
}