import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Alert, Image,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/time';

const GENRE_GRADIENTS = {
  'Rock':       ['#E94560', '#7C1AED'],
  'Pop':        ['#FF6B9D', '#C44569'],
  'Rap':        ['#2C3E50', '#F39C12'],
  'Elektronik': ['#00D4AA', '#0066CC'],
  'Jazz':       ['#F5A623', '#8B4513'],
  'Klasik':     ['#4A0E8F', '#1a237e'],
  'Indie':      ['#00BCD4', '#2E7D32'],
  'R&B':        ['#9C27B0', '#E91E63'],
  'Folk':       ['#8BC34A', '#5D4037'],
  'Reggae':     ['#43A047', '#FDD835'],
  'Arabesk':    ['#8B0000', '#DAA520'],
};

function getGenreGradient(genre) {
  if (!genre) return ['#E94560', '#7C3AED'];
  const key = Object.keys(GENRE_GRADIENTS).find(k =>
    genre.toLowerCase().includes(k.toLowerCase())
  );
  return GENRE_GRADIENTS[key] || ['#E94560', '#7C3AED'];
}

function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function StarRating({ value, onChange, size = 26 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity key={star} onPress={() => onChange && onChange(star)} activeOpacity={0.7}>
          <Text style={{ fontSize: size, color: star <= value ? '#F5A623' : '#555' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function StarDisplay({ value, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <Text key={star} style={{ fontSize: size, color: star <= Math.round(value) ? '#F5A623' : '#444' }}>★</Text>
      ))}
    </View>
  );
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const TAB_COUNT = 3;

const gradientSets = [
  ['#E94560', '#7C3AED'],
  ['#F5A623', '#E94560'],
  ['#00D4AA', '#7C3AED'],
  ['#7C3AED', '#F5A623'],
];

const eventEmojis = ['🎸', '🎤', '🥁', '🎹', '🎺', '🎻', '🎪', '🎭'];

export default function ArtistProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { artistId, artistName } = route.params;

  const [artist, setArtist] = useState(null);
  const [events, setEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('events');

  const [myRating, setMyRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAll();
  }, [artistId]);

  const fetchAll = async () => {
    try {
      const [artistRes, eventsRes, postsRes, reviewsRes, pastEventsRes] = await Promise.all([
        API.get(`/artists/${artistId}?currentUserId=${session.userId}`),
        API.get(`/artists/${artistId}/events`),
        API.get(`/artists/${artistId}/posts`),
        API.get(`/artists/${artistId}/reviews`),
        API.get(`/artists/${artistId}/past-events`),
      ]);
      setArtist(artistRes.data);
      setFollowing(artistRes.data.isFollowedByCurrentUser || false);
      setEvents(eventsRes.data.filter(e => new Date(e.eventDate) >= new Date()));
      setPastEvents(pastEventsRes.data);
      setPosts(postsRes.data);
      setReviews(reviewsRes.data);
      const mine = reviewsRes.data.find(r => r.userId === session.userId);
      if (mine) { setMyRating(mine.rating); setReviewText(mine.comment || ''); }

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();
    } catch (err) {
      console.log('artist fetch error:', err.message);
      Alert.alert(t('error'), t('artist_load_error'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await API.delete(`/artists/${artistId}/follow?userId=${session.userId}`);
        setArtist(prev => ({ ...prev, followerCount: Math.max(0, (prev.followerCount || 1) - 1) }));
      } else {
        await API.post(`/artists/${artistId}/follow?userId=${session.userId}`);
        setArtist(prev => ({ ...prev, followerCount: (prev.followerCount || 0) + 1 }));
      }
    } catch {
      setFollowing(wasFollowing);
      Alert.alert(t('error'), t('artist_action_error'));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!myRating) { Alert.alert(t('review_no_rating'), t('review_no_rating_sub')); return; }
    setReviewLoading(true);
    try {
      const res = await API.post(`/artists/${artistId}/reviews`, {
        rating: myRating,
        comment: reviewText.trim() || null,
      });
      setReviews(prev => {
        const filtered = prev.filter(r => r.userId !== session.userId);
        return [res.data, ...filtered];
      });
      Alert.alert(t('review_saved_title'), t('review_saved_msg'));
    } catch {
      Alert.alert(t('error'), t('review_error'));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteReview = () => {
    Alert.alert(t('review_delete_title'), t('review_delete_msg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('review_delete'), style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/artists/${artistId}/reviews`);
            setReviews(prev => prev.filter(r => r.userId !== session.userId));
            setMyRating(0);
            setReviewText('');
          } catch {
            Alert.alert(t('error'), t('review_del_error'));
          }
        },
      },
    ]);
  };

  const switchTab = (tab, index) => {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: index,
      tension: 70, friction: 10, useNativeDriver: false,
    }).start();
  };

  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0%', `${100 / TAB_COUNT}%`, `${(200 / TAB_COUNT)}%`],
  });

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
    : null;

  const myReview = reviews.find(r => r.userId === session.userId);

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <LinearGradient colors={colors.headerGradient} style={styles.hero}>
        <View style={styles.heroBgCircle} />

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.heroInner, { transform: [{ scale: scaleAnim }] }]}>
          {artist?.imageUrl ? (
            <Image source={{ uri: artist.imageUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={getGenreGradient(artist?.genre)} style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {getInitials(artist?.name || artistName)}
              </Text>
            </LinearGradient>
          )}

          <View style={styles.micBadge}>
            <Text style={styles.micEmoji}>🎤</Text>
          </View>

          <Text style={styles.artistName}>{artist?.name || artistName}</Text>

          {/* Ortalama puan — yorum varsa göster */}
          {avgRating !== null && (
            <View style={styles.avgRatingRow}>
              <StarDisplay value={avgRating} size={16} />
              <Text style={styles.avgRatingText}>
                {avgRating.toFixed(1)} ({reviews.length} yorum)
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{artist?.followerCount || 0}</Text>
              <Text style={styles.statLabel}>{t('artist_followers')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{events.length + pastEvents.length}</Text>
              <Text style={styles.statLabel}>{t('artist_events_label')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{reviews.length}</Text>
              <Text style={styles.statLabel}>Yorum</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleFollowToggle}
            disabled={followLoading}
            style={styles.followWrapper}
            activeOpacity={0.85}
          >
            {following ? (
              <View style={styles.followingButton}>
                {followLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.followingText}>{t('artist_following')}</Text>
                }
              </View>
            ) : (
              <LinearGradient
                colors={['#E94560', '#7C3AED']}
                style={styles.followButton}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {followLoading
                  ? <ActivityIndicator size="small" color={colors.text} />
                  : <Text style={styles.followText}>{t('artist_follow')}</Text>
                }
              </LinearGradient>
            )}
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      {/* ── SEKMELER ────────────────────────────────────────────────────── */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.tabBar}>
          <Animated.View style={[styles.tabIndicator, { left: tabIndicatorLeft }]} />
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('events', 0)}>
            <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
              {t('artist_tab_events', { count: events.length })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('posts', 1)}>
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              {t('artist_tab_posts', { count: posts.length })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('reviews', 2)}>
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
              ⭐ {reviews.length}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── İÇERİK ──────────────────────────────────────────────────────── */}
      <View style={styles.content}>

        {activeTab === 'events' && (
          <View>
            {/* YAKLAŞAN ETKİNLİKLER */}
            {events.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🎭</Text>
                <Text style={styles.emptyText}>{t('artist_no_events')}</Text>
              </View>
            ) : (
              <View style={styles.eventGrid}>
                {events.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.eventCard}
                    onPress={() => navigation.navigate('EventDetail', { event: item })}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={gradientSets[index % gradientSets.length]}
                      style={styles.eventCardGradient}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.eventEmoji}>{eventEmojis[index % eventEmojis.length]}</Text>
                      <View style={styles.eventCardBody}>
                        <Text style={styles.eventName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.eventDate}>
                          📅 {new Date(item.eventDate).toLocaleDateString('tr-TR', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </Text>
                        {item.venueCity && <Text style={styles.eventCity}>📍 {item.venueCity}</Text>}
                      </View>
                      <View style={[
                        styles.approvedDot,
                        { backgroundColor: item.isApproved ? '#00D4AA' : '#F5A623' },
                      ]} />
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* SON KONSERLER */}
            {pastEvents.length > 0 && (
              <View style={styles.pastSection}>
                <View style={styles.pastSectionHeader}>
                  <View style={[styles.pastSectionLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.pastSectionTitle, { color: colors.textSecondary }]}>Son Konserler</Text>
                  <View style={[styles.pastSectionLine, { backgroundColor: colors.border }]} />
                </View>

                {pastEvents.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.pastCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => navigation.navigate('EventDetail', { event: item })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.pastCardLeft}>
                      <Text style={[styles.pastCardDate, { color: colors.textSecondary }]}>
                        {new Date(item.eventDate).toLocaleDateString('tr-TR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                      <Text style={[styles.pastCardName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.venueCity && (
                        <Text style={[styles.pastCardCity, { color: colors.textSecondary }]}>
                          📍 {item.venueCity}
                        </Text>
                      )}
                    </View>

                    <View style={styles.pastCardRight}>
                      {item.avgRating != null && item.avgRating > 0 ? (
                        <>
                          <StarDisplay value={item.avgRating} size={13} />
                          <Text style={[styles.pastCardRating, { color: colors.textSecondary }]}>
                            {Number(item.avgRating).toFixed(1)} · {item.reviewCount} yorum
                          </Text>
                        </>
                      ) : (
                        <Text style={[styles.pastCardNoRating, { color: colors.textSecondary }]}>
                          Henüz puan yok
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'posts' && (
          posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>{t('artist_no_posts')}</Text>
            </View>
          ) : (
            posts.map((item, index) => (
              <View key={item.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <LinearGradient
                    colors={gradientSets[index % gradientSets.length]}
                    style={styles.postAvatar}
                  >
                    <Text style={styles.postAvatarText}>
                      {item.username?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </LinearGradient>
                  <View style={styles.postHeaderInfo}>
                    <Text style={styles.postUsername}>@{item.username}</Text>
                    <Text style={styles.postEvent}>🎵 {item.eventName}</Text>
                  </View>
                  <Text style={styles.postDate}>
                    {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                      day: 'numeric', month: 'short',
                    })}
                  </Text>
                </View>
                <Text style={styles.postContent}>{item.content}</Text>
                <View style={styles.postFooter}>
                  <Text style={styles.postStat}>❤️ {item.likeCount || 0}</Text>
                  <Text style={styles.postStat}>💬 {item.commentCount || 0}</Text>
                </View>
              </View>
            ))
          )
        )}

        {activeTab === 'reviews' && (
          <View>
            {/* YORUM FORMU */}
            <View style={[styles.reviewForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.reviewFormTitle, { color: colors.text }]}>
                {myReview ? 'Yorumunu Güncelle' : 'Bu Sanatçıyı Değerlendir'}
              </Text>
              <View style={styles.reviewStarRow}>
                <StarRating value={myRating} onChange={setMyRating} size={32} />
                {myReview && (
                  <TouchableOpacity onPress={handleDeleteReview} style={styles.deleteReviewBtn}>
                    <Text style={styles.deleteReviewText}>Sil</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.reviewInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Yorumun (isteğe bağlı)..."
                placeholderTextColor={colors.textSecondary}
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                maxLength={300}
              />
              <TouchableOpacity
                style={[styles.reviewSubmitBtn, { opacity: reviewLoading ? 0.6 : 1 }]}
                onPress={handleSubmitReview}
                disabled={reviewLoading}
              >
                <LinearGradient
                  colors={['#E94560', '#7C3AED']}
                  style={styles.reviewSubmitGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.reviewSubmitText}>
                    {reviewLoading ? 'Kaydediliyor...' : myReview ? 'Güncelle' : 'Yorum Yap'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* YORUM LİSTESİ */}
            {reviews.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyText}>Henüz yorum yapılmamış.</Text>
                <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                  İlk yorumu sen yap!
                </Text>
              </View>
            ) : (
              reviews.map(r => (
                <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.reviewHeader}>
                    <LinearGradient
                      colors={['#E94560', '#7C3AED']}
                      style={styles.reviewAvatar}
                    >
                      <Text style={styles.reviewAvatarText}>
                        {r.username?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </LinearGradient>
                    <View style={styles.reviewMeta}>
                      <Text style={[styles.reviewUsername, { color: colors.text }]}>@{r.username}</Text>
                      <StarDisplay value={r.rating} />
                    </View>
                    <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
                      {formatTimeAgo(r.createdAt)}
                    </Text>
                  </View>
                  {r.comment ? (
                    <Text style={[styles.reviewComment, { color: colors.text }]}>{r.comment}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}

      </View>
    </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

    // HERO
    hero: { paddingTop: 56, paddingBottom: 32, paddingHorizontal: 24, overflow: 'hidden', position: 'relative' },
    heroBgCircle: {
      position: 'absolute', width: 300, height: 300, borderRadius: 150,
      backgroundColor: colors.primary + '15', top: -80, right: -80,
    },
    backButton: { marginBottom: 24 },
    backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
    heroInner: { alignItems: 'center' },
    avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: colors.border, marginBottom: 6 },
    avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    avatarLetter: { fontSize: 52, fontWeight: '900', color: 'rgba(255,255,255,0.95)', letterSpacing: -1 },
    micBadge: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: colors.border, marginBottom: 12, marginTop: -16,
    },
    micEmoji: { fontSize: 14 },
    artistName: { fontSize: 26, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' },

    avgRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    avgRatingText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: 16,
      paddingVertical: 14, paddingHorizontal: 24, gap: 20,
      marginBottom: 20, borderWidth: 1, borderColor: colors.border, width: '100%',
    },
    stat: { alignItems: 'center', flex: 1 },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
    statDivider: { width: 1, height: 32, backgroundColor: colors.border },

    followWrapper: { width: '100%' },
    followButton: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    followText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    followingButton: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 2, borderColor: colors.primary },
    followingText: { color: colors.primary, fontWeight: 'bold', fontSize: 15 },

    // SEKMELER
    tabBarWrapper: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16, paddingVertical: 10 },
    tabBar: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: 12, padding: 4, position: 'relative', overflow: 'hidden' },
    tabIndicator: {
      position: 'absolute', top: 4, bottom: 4,
      width: `${100 / TAB_COUNT}%`,
      backgroundColor: colors.primary, borderRadius: 8,
    },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', zIndex: 1 },
    tabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.text },

    content: { padding: 16, paddingBottom: 48 },

    // ETKİNLİK GRİD
    eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    eventCard: { width: CARD_WIDTH, borderRadius: 18, overflow: 'hidden' },
    eventCardGradient: { padding: 14, minHeight: 160, justifyContent: 'space-between', position: 'relative' },
    eventEmoji: { fontSize: 32, marginBottom: 8 },
    eventCardBody: { flex: 1 },
    eventName: { fontSize: 13, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
    eventDate: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginBottom: 3 },
    eventCity: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
    approvedDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },

    // POST KARTI
    postCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    postAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    postAvatarText: { color: colors.text, fontWeight: 'bold', fontSize: 16 },
    postHeaderInfo: { flex: 1 },
    postUsername: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    postEvent: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    postDate: { fontSize: 11, color: colors.textSecondary },
    postContent: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 12 },
    postFooter: { flexDirection: 'row', gap: 14 },
    postStat: { fontSize: 13, color: colors.textSecondary },

    // YORUM FORMU
    reviewForm: {
      borderRadius: 16, borderWidth: 1, padding: 16,
      marginBottom: 20,
    },
    reviewFormTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
    reviewStarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    deleteReviewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#E9456022' },
    deleteReviewText: { color: '#E94560', fontSize: 13, fontWeight: '700' },
    reviewInput: {
      borderWidth: 1, borderRadius: 10,
      padding: 12, fontSize: 14, minHeight: 80,
      textAlignVertical: 'top', marginBottom: 12,
    },
    reviewSubmitBtn: { borderRadius: 12, overflow: 'hidden' },
    reviewSubmitGradient: { paddingVertical: 12, alignItems: 'center' },
    reviewSubmitText: { color: '#fff', fontWeight: '800', fontSize: 14 },

    // YORUM LİSTESİ
    reviewCard: {
      borderRadius: 14, borderWidth: 1, padding: 14,
      marginBottom: 10,
    },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    reviewAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    reviewAvatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    reviewMeta: { flex: 1, gap: 3 },
    reviewUsername: { fontSize: 13, fontWeight: '700' },
    reviewDate: { fontSize: 11 },
    reviewComment: { fontSize: 14, lineHeight: 20 },

    // BOŞ
    empty: { alignItems: 'center', paddingVertical: 56 },
    emptyEmoji: { fontSize: 52, marginBottom: 14 },
    emptyText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
    emptySubText: { fontSize: 13, marginTop: 6 },

    // SON KONSERLER
    pastSection: { marginTop: 24 },
    pastSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    pastSectionLine: { flex: 1, height: 1 },
    pastSectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
    pastCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: 14, borderWidth: 1,
      paddingHorizontal: 14, paddingVertical: 12,
      marginBottom: 8,
    },
    pastCardLeft: { flex: 1, paddingRight: 12 },
    pastCardDate: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
    pastCardName: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
    pastCardCity: { fontSize: 11 },
    pastCardRight: { alignItems: 'flex-end', gap: 4 },
    pastCardRating: { fontSize: 11, fontWeight: '600' },
    pastCardNoRating: { fontSize: 11, fontStyle: 'italic' },
  });
}
