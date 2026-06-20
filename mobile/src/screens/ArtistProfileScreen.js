import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Alert, Image,
  TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTimeAgo, parseEventDate } from '../utils/time';

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

function formatFollowers(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

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

  useEffect(() => {
    fetchAll();
  }, [artistId]);

  const fetchAll = async () => {
    // Parçalı yükleme: ana sanatçı verisi başarısızsa sayfayı açma; ikincil
    // çağrılar (etkinlik/post/yorum) başarısızsa sadece o sekme boş kalsın —
    // tek bir yavaş/hatalı çağrı koca sayfayı çökertmesin.
    const [artistRes, eventsRes, postsRes, reviewsRes, pastEventsRes] = await Promise.allSettled([
      API.get(`/artists/${artistId}?currentUserId=${session.userId}`),
      API.get(`/artists/${artistId}/events`),
      API.get(`/artists/${artistId}/posts`),
      API.get(`/artists/${artistId}/reviews`),
      API.get(`/artists/${artistId}/past-events`),
    ]);

    if (artistRes.status !== 'fulfilled') {
      console.log('artist fetch error:', artistRes.reason?.message);
      Alert.alert(t('error'), t('artist_load_error'));
      navigation.goBack();
      return;
    }

    setArtist(artistRes.value.data);
    setFollowing(artistRes.value.data.followedByCurrentUser || false);
    setEvents(eventsRes.status === 'fulfilled'
      ? eventsRes.value.data.filter(e => parseEventDate(e.eventDate) >= new Date())
      : []);
    setPastEvents(pastEventsRes.status === 'fulfilled' ? pastEventsRes.value.data : []);
    setPosts(postsRes.status === 'fulfilled' ? postsRes.value.data : []);
    if (reviewsRes.status === 'fulfilled') {
      setReviews(reviewsRes.value.data);
      const mine = reviewsRes.value.data.find(r => r.userId === session.userId);
      if (mine) { setMyRating(mine.rating); setReviewText(mine.comment || ''); }
    }

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    setLoading(false);
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
          {/* Sol: avatar */}
          <View style={styles.avatarCol}>
            {artist?.imageUrl ? (
              <Image source={{ uri: artist.imageUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={getGenreGradient(artist?.genre)} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {getInitials(artist?.name || artistName)}
                </Text>
              </LinearGradient>
            )}
          </View>

          {/* Sağ: bilgiler */}
          <View style={styles.infoCol}>
            <Text style={styles.artistName} numberOfLines={2}>{artist?.name || artistName}</Text>

            {/* Yıldızlar */}
            {avgRating !== null && (
              <View style={styles.avgRatingRow}>
                <StarDisplay value={avgRating} size={14} />
                <Text style={styles.avgRatingText}>{avgRating.toFixed(1)}</Text>
                <Text style={styles.avgRatingCount}>({reviews.length})</Text>
              </View>
            )}

            {/* Genre tag'leri */}
            {(artist?.genreTags || artist?.genre) && (
              <Text style={styles.genreTagsText} numberOfLines={2}>
                🎵 {artist.genreTags || artist.genre}
              </Text>
            )}

            {/* Spotify takipçi */}
            {artist?.spotifyFollowers != null && (
              <Text style={styles.spotifyFollowersText}>
                🎧 {formatFollowers(artist.spotifyFollowers)} Spotify takipçi
              </Text>
            )}

            {/* Popülerlik barı */}
            {artist?.popularity != null && (
              <View style={styles.popularityRow}>
                <Text style={styles.popularityLabel}>{t('artist_popularity')}</Text>
                <View style={[styles.popularityTrack, { backgroundColor: colors.border }]}>
                  <LinearGradient
                    colors={['#1DB954', '#00D4AA']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.popularityFill, { width: `${artist.popularity}%` }]}
                  />
                </View>
                <Text style={styles.popularityValue}>{artist.popularity}</Text>
              </View>
            )}

            {/* Butonlar */}
            <View style={styles.heroActions}>
              <TouchableOpacity
                onPress={handleFollowToggle}
                disabled={followLoading}
                style={styles.followWrapper}
                activeOpacity={0.85}
              >
                {following ? (
                  <View style={[styles.followingButton, { borderColor: colors.primary }]}>
                    {followLoading
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={[styles.followingText, { color: colors.primary }]}>{t('artist_following')}</Text>
                    }
                  </View>
                ) : (
                  <LinearGradient
                    colors={['#E94560', '#7C3AED']}
                    style={styles.followButton}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    {followLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.followText}>{t('artist_follow')}</Text>
                    }
                  </LinearGradient>
                )}
              </TouchableOpacity>

              {artist?.spotifyId && (
                <TouchableOpacity
                  style={styles.spotifyMiniBtn}
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL(`https://open.spotify.com/artist/${artist.spotifyId}`)}
                >
                  <Text style={styles.spotifyMiniBtnText}>↗</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Stats bar */}
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
            <Text style={styles.statLabel}>{t('artist_reviews_label')}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── SEKMELER ────────────────────────────────────────────────────── */}
      <View style={styles.tabs}>
        {[
          { key: 'events',  icon: '🎫', count: events.length },
          { key: 'posts',   icon: '📝', count: posts.length },
          { key: 'reviews', icon: '⭐', count: reviews.length },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabCount, activeTab === tab.key && styles.tabCountActive]}>
              {tab.count}
            </Text>
          </TouchableOpacity>
        ))}
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
                          📅 {parseEventDate(item.eventDate).toLocaleDateString('tr-TR', {
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
                  <Text style={[styles.pastSectionTitle, { color: colors.textSecondary }]}>{t('artist_past_concerts')}</Text>
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
                        {parseEventDate(item.eventDate).toLocaleDateString('tr-TR', {
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
                {myReview ? t('artist_review_form_title_edit') : t('artist_review_form_title_new')}
              </Text>
              <View style={styles.reviewStarRow}>
                <StarRating value={myRating} onChange={setMyRating} size={32} />
                {myReview && (
                  <TouchableOpacity onPress={handleDeleteReview} style={styles.deleteReviewBtn}>
                    <Text style={styles.deleteReviewText}>{t('delete')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.reviewInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder={t('artist_review_placeholder')}
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
                    {reviewLoading ? t('artist_review_saving') : myReview ? t('artist_review_update') : t('artist_review_submit')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* YORUM LİSTESİ */}
            {reviews.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyText}>{t('artist_no_reviews')}</Text>
                <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                  {t('artist_no_reviews_sub')}
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
    heroInner: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 16 },
    avatarCol: { alignItems: 'center' },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.border },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { fontSize: 44, fontWeight: '900', color: 'rgba(255,255,255,0.95)' },
    infoCol: { flex: 1, paddingTop: 2 },
    artistName: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 6, lineHeight: 27 },

    avgRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    avgRatingText: { color: '#F5A623', fontSize: 13, fontWeight: '700' },
    avgRatingCount: { color: colors.textSecondary, fontSize: 11 },

    genreTagsText: { color: colors.textSecondary, fontSize: 12, marginBottom: 5, lineHeight: 17 },
    spotifyFollowersText: { color: colors.textSecondary, fontSize: 12, marginBottom: 5 },
    popularityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    popularityLabel: { color: colors.textSecondary, fontSize: 11 },
    popularityTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
    popularityFill: { height: '100%', borderRadius: 3 },
    popularityValue: { color: colors.textSecondary, fontSize: 11, minWidth: 22, textAlign: 'right' },

    heroActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
    followWrapper: { flex: 1 },
    followButton: { paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    followText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    followingButton: { paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 2 },
    followingText: { fontWeight: 'bold', fontSize: 14 },
    spotifyMiniBtn: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: '#1DB954' + '20',
      borderWidth: 1, borderColor: '#1DB954',
      justifyContent: 'center', alignItems: 'center',
    },
    spotifyMiniBtnText: { color: '#1DB954', fontSize: 18, fontWeight: '700' },

    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: 16,
      paddingVertical: 14, paddingHorizontal: 24, gap: 20,
      borderWidth: 1, borderColor: colors.border, width: '100%',
    },
    stat: { alignItems: 'center', flex: 1 },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
    statDivider: { width: 1, height: 32, backgroundColor: colors.border },

    // SEKMELER (emoji + sayı, profil ekranıyla aynı)
    tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', gap: 3, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.primary },
    tabIcon: { fontSize: 20 },
    tabCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    tabCountActive: { color: colors.text },

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
