import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Alert, Image,
  TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
// Ionicons'ta Spotify logosu yok: yalnızca o buton FontAwesome kullanır
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import EventCard from '../components/EventCard';
import DeepLinkLoader from '../components/DeepLinkLoader';
import API from '../services/api';
import { useTheme } from '../theme';
import { ProfileSkeletonPage } from '../components/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { buildShareUrl, shareWithLink } from '../services/shareLinks';
import { formatTimeAgo, parseEventDate, dateLocale } from '../utils/time';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { hapticLight } from '../utils/haptics';

function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function StarRating({ value, onChange, size = 26, colors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity
          key={star}
          onPress={() => onChange && onChange(star)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${star}/5`}
          accessibilityState={{ selected: star <= value }}
        >
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={star <= value ? colors.secondary : colors.textSecondary}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function StarDisplay({ value, size = 14, colors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${Math.round(value)}/5`}>
      {[1, 2, 3, 4, 5].map(star => (
        <Ionicons
          key={star}
          name={star <= Math.round(value) ? 'star' : 'star-outline'}
          size={size}
          color={star <= Math.round(value) ? colors.secondary : colors.border}
        />
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


export default function ArtistProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t, tu, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { artistId, artistName } = route.params;

  const [artist, setArtist] = useState(null);
  const [events, setEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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

  // Benzer sanatçılar ayrı yüklenir: Deezer yavaşsa profil beklemesin, hata olursa şerit gizli kalır
  useEffect(() => {
    let cancelled = false;
    setSimilar([]);
    if (!/^\d+$/.test(String(artistId ?? ''))) return undefined;
    API.get(`/artists/${artistId}/similar`)
      .then(res => { if (!cancelled) setSimilar(Array.isArray(res.data) ? res.data : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [artistId]);

  const fetchAll = async () => {
    // Geçersiz id (ör. /artist/abc) için istek atmadan "bulunamadı" göster
    if (!/^\d+$/.test(String(artistId ?? ''))) {
      setNotFound(true);
      setLoading(false);
      return;
    }
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
      // Eskiden burada setLoading(false) çağrılmadığı için iskelet sonsuza kadar dönüyordu
      console.log('artist fetch error:', artistRes.reason?.message);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setArtist(artistRes.value.data);
    setFollowing(artistRes.value.data.followedByCurrentUser || false);
    // /events yaklaşan + geçmişi birlikte döndürür; geçmişler ayrı listede olduğundan
    // aynı kayıt iki kez sayılmasın (N-61)
    const pastList = pastEventsRes.status === 'fulfilled' ? pastEventsRes.value.data : [];
    const pastIds = new Set(pastList.map(e => e.id));
    setEvents(eventsRes.status === 'fulfilled'
      ? eventsRes.value.data.filter(e => parseEventDate(e.eventDate) >= new Date() && !pastIds.has(e.id))
      : []);
    setPastEvents(pastList);
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
    hapticLight();
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


  const shareArtist = () => {
    if (!artist) return;
    const genre = artist.genre ? ` · ${artist.genre}` : '';
    shareWithLink(`🎤 ${artist.name}${genre}`, buildShareUrl('artist', artistId));
  };

  if (notFound) return <DeepLinkLoader error onBack={() => navigation.navigate('MainApp')} />;
  if (loading) return <ProfileSkeletonPage hero />;

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
      <View style={styles.hero}>

        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => goBackOrFallback(navigation)} accessibilityRole="button">
            <Text style={styles.backText}>{t('back')}</Text>
          </TouchableOpacity>
          {/* Sanatçı sayfası paylaşımı — linki alan kişi uygulamada açar */}
          <TouchableOpacity style={styles.shareIconBtn} onPress={shareArtist} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('share')}>
            <Ionicons name="share-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.heroInner, { transform: [{ scale: scaleAnim }] }]}>
          {/* Sol: avatar */}
          <View style={styles.avatarCol}>
            {artist?.imageUrl ? (
              <Image source={{ uri: artist.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {getInitials(artist?.name || artistName)}
                </Text>
              </View>
            )}
          </View>

          {/* Sağ: bilgiler */}
          <View style={styles.infoCol}>
            <Text style={styles.artistName} numberOfLines={2}>{artist?.name || artistName}</Text>

            {/* Yıldızlar */}
            {avgRating !== null && (
              <View style={styles.avgRatingRow}>
                <StarDisplay value={avgRating} size={14} colors={colors} />
                <Text style={styles.avgRatingText}>{avgRating.toFixed(1)}</Text>
                <Text style={styles.avgRatingCount}>({reviews.length})</Text>
              </View>
            )}

            {/* Genre tag'leri */}
            {(artist?.genreTags || artist?.genre) && (
              <View style={styles.metaRow}>
                <Ionicons name="musical-notes-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.genreTagsText, styles.metaText]} numberOfLines={2}>
                  {artist.genreTags || artist.genre}
                </Text>
              </View>
            )}

            {/* Spotify takipçi */}
            {artist?.spotifyFollowers != null && (
              <View style={styles.metaRow}>
                <Ionicons name="headset-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.spotifyFollowersText, styles.metaText]}>
                  {t('artist_spotify_followers', { count: formatFollowers(artist.spotifyFollowers) })}
                </Text>
              </View>
            )}

            {/* Popülerlik barı */}
            {artist?.popularity != null && (
              <View style={styles.popularityRow}>
                <Text style={styles.popularityLabel}>{t('artist_popularity')}</Text>
                <View style={[styles.popularityTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.popularityFill, { width: `${artist.popularity}%` }]} />
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
                accessibilityRole="button"
                accessibilityLabel={following ? t('artist_following') : t('artist_follow')}
                accessibilityState={{ selected: following, busy: followLoading }}
              >
                {following ? (
                  <View style={[styles.followingButton, { borderColor: colors.primary }]}>
                    {followLoading
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={[styles.followingText, { color: colors.primary }]}>{t('artist_following')}</Text>
                    }
                  </View>
                ) : (
                  <View style={styles.followButton}>
                    {followLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.followText}>{t('artist_follow')}</Text>
                    }
                  </View>
                )}
              </TouchableOpacity>

              {artist?.spotifyId && (
                <TouchableOpacity
                  style={styles.spotifyMiniBtn}
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL(`https://open.spotify.com/artist/${artist.spotifyId}`)}
                  accessibilityRole="link"
                  accessibilityLabel={t('artist_open_spotify')}
                >
                  <FontAwesome name="spotify" size={22} color="#1DB954" />
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
      </View>

      {/* ── BENZER SANATÇILAR ───────────────────────────────────────────── */}
      {similar.length > 0 && (
        <View style={styles.similarSection}>
          <Text style={styles.similarTitle}>{t('artist_similar')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
            {similar.map(a => (
              <TouchableOpacity
                key={a.id}
                style={styles.similarItem}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={a.name}
                // push: geri tuşu bir önceki sanatçıya dönsün (navigate aynı ekranın parametresini değiştirirdi)
                onPress={() => navigation.push('ArtistProfile', { artistId: a.id, artistName: a.name })}
              >
                {a.imageUrl ? (
                  <Image source={{ uri: a.imageUrl }} style={styles.similarAvatar} />
                ) : (
                  <View style={[styles.similarAvatar, styles.similarInitialsWrap]}>
                    <Text style={styles.similarInitials}>{getInitials(a.name)}</Text>
                  </View>
                )}
                <Text style={styles.similarName} numberOfLines={2}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── SEKMELER ────────────────────────────────────────────────────── */}
      <View style={styles.tabs}>
        {[
          { key: 'events',  icon: 'ticket-outline', count: events.length + pastEvents.length },
          { key: 'posts',   icon: 'document-text-outline', count: posts.length },
          { key: 'reviews', icon: 'star-outline', count: reviews.length },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
            accessibilityLabel={`${t(`artist_${tab.key}_label`)}: ${tab.count}`}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? colors.primary : colors.textSecondary}
            />
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
                <Ionicons name="calendar-outline" size={52} color={colors.textSecondary} style={styles.emptyIcon} />
                <Text style={styles.emptyText}>{t('artist_no_events')}</Text>
              </View>
            ) : (
              <View style={styles.eventGrid}>
                {events.map((item) => (
                  <EventCard
                    key={item.id}
                    item={item}
                    variant="tile"
                    style={styles.eventTile}
                    onPress={() => openEvent(navigation, item)}
                  />
                ))}
              </View>
            )}

            {/* SON KONSERLER */}
            {pastEvents.length > 0 && (
              <View style={styles.pastSection}>
                <View style={styles.pastSectionHeader}>
                  <View style={[styles.pastSectionLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.pastSectionTitle, { color: colors.textSecondary }]}>{tu('artist_past_concerts')}</Text>
                  <View style={[styles.pastSectionLine, { backgroundColor: colors.border }]} />
                </View>

                {pastEvents.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.pastCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => openEvent(navigation, item)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <View style={styles.pastCardLeft}>
                      <Text style={[styles.pastCardDate, { color: colors.textSecondary }]}>
                        {parseEventDate(item.eventDate).toLocaleDateString(dateLocale(lang), {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                      <Text style={[styles.pastCardName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.venueCity && (
                        <View style={styles.metaRow}>
                          <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                          <Text style={[styles.pastCardCity, { color: colors.textSecondary }]}>
                            {item.venueCity}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.pastCardRight}>
                      {item.avgRating != null && item.avgRating > 0 ? (
                        <>
                          <StarDisplay value={item.avgRating} size={13} colors={colors} />
                          <Text style={[styles.pastCardRating, { color: colors.textSecondary }]}>
                            {Number(item.avgRating).toFixed(1)} · {t('artist_review_count', { count: item.reviewCount })}
                          </Text>
                        </>
                      ) : (
                        <Text style={[styles.pastCardNoRating, { color: colors.textSecondary }]}>
                          {t('artist_no_rating')}
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
              <Ionicons name="document-text-outline" size={52} color={colors.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>{t('artist_no_posts')}</Text>
            </View>
          ) : (
            posts.map((item, index) => (
              <View key={item.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.postAvatar}>
                    <Text style={styles.postAvatarText}>
                      {item.username?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.postHeaderInfo}>
                    <Text style={styles.postUsername}>@{item.username}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="musical-notes-outline" size={12} color={colors.textSecondary} />
                      <Text style={[styles.postEvent, styles.postEventText]} numberOfLines={1}>{item.eventName}</Text>
                    </View>
                  </View>
                  <Text style={styles.postDate}>
                    {new Date(item.createdAt).toLocaleDateString(dateLocale(lang), {
                      day: 'numeric', month: 'short',
                    })}
                  </Text>
                </View>
                <Text style={styles.postContent}>{item.content}</Text>
                <View style={styles.postFooter}>
                  <View style={styles.postStatItem}>
                    <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.postStat}>{item.likeCount || 0}</Text>
                  </View>
                  <View style={styles.postStatItem}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.postStat}>{item.commentCount || 0}</Text>
                  </View>
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
                <StarRating value={myRating} onChange={setMyRating} size={32} colors={colors} />
                {myReview && (
                  <TouchableOpacity onPress={handleDeleteReview} style={styles.deleteReviewBtn} accessibilityRole="button">
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
                accessibilityRole="button"
                accessibilityState={{ disabled: reviewLoading, busy: reviewLoading }}
              >
                <View style={styles.reviewSubmitInner}>
                  <Text style={styles.reviewSubmitText}>
                    {reviewLoading ? t('artist_review_saving') : myReview ? t('artist_review_update') : t('artist_review_submit')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* YORUM LİSTESİ */}
            {reviews.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={52} color={colors.textSecondary} style={styles.emptyIcon} />
                <Text style={styles.emptyText}>{t('artist_no_reviews')}</Text>
                <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                  {t('artist_no_reviews_sub')}
                </Text>
              </View>
            ) : (
              reviews.map(r => (
                <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>
                        {r.username?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.reviewMeta}>
                      <Text style={[styles.reviewUsername, { color: colors.text }]}>@{r.username}</Text>
                      <StarDisplay value={r.rating} colors={colors} />
                    </View>
                    <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
                      {formatTimeAgo(r.createdAt, lang)}
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
    backButton: { marginBottom: 24 },
    heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    shareIconBtn: {
      backgroundColor: colors.card,
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
    heroInner: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 16 },
    avatarCol: { alignItems: 'center' },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.border },
    avatarPlaceholder: {
      width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 3, borderColor: colors.border,
    },
    avatarLetter: { fontSize: 44, fontWeight: '900', color: colors.text },
    infoCol: { flex: 1, paddingTop: 2 },
    artistName: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 6, lineHeight: 27 },

    avgRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    avgRatingText: { color: '#F5A623', fontSize: 13, fontWeight: '700' },
    avgRatingCount: { color: colors.textSecondary, fontSize: 11 },

    genreTagsText: { color: colors.textSecondary, fontSize: 12, marginBottom: 5, lineHeight: 17 },
    spotifyFollowersText: { color: colors.textSecondary, fontSize: 12, marginBottom: 5 },
    // İkon + metin satırı (tür, Spotify takipçi, şehir, etkinlik adı)
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { flexShrink: 1 },
    popularityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    popularityLabel: { color: colors.textSecondary, fontSize: 11 },
    popularityTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
    popularityFill: { height: '100%', borderRadius: 3, backgroundColor: '#1DB954' },
    popularityValue: { color: colors.textSecondary, fontSize: 11, minWidth: 22, textAlign: 'right' },

    heroActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
    followWrapper: { flex: 1 },
    followButton: { paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary },
    followText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    followingButton: { paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 2 },
    followingText: { fontWeight: 'bold', fontSize: 14 },
    spotifyMiniBtn: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: '#1DB954' + '20',
      borderWidth: 1, borderColor: '#1DB954',
      justifyContent: 'center', alignItems: 'center',
    },

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
    similarSection: { paddingTop: 16, paddingBottom: 12, gap: 10, backgroundColor: colors.background },
    similarTitle: { color: colors.text, fontSize: 16, fontWeight: '800', paddingHorizontal: 16 },
    similarRow: { gap: 14, paddingHorizontal: 16 },
    similarItem: { width: 72, alignItems: 'center' },
    similarAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card },
    similarInitialsWrap: {
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    similarInitials: { color: colors.text, fontSize: 20, fontWeight: '800' },
    similarName: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 6 },
    tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', gap: 3, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.primary },
    tabCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    tabCountActive: { color: colors.text },

    content: { padding: 16, paddingBottom: 48 },

    // ETKİNLİK GRİD
    eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    eventTile: { width: CARD_WIDTH, marginBottom: 0 },
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
    postAvatar: {
      width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    postAvatarText: { color: colors.text, fontWeight: 'bold', fontSize: 16 },
    postHeaderInfo: { flex: 1 },
    postUsername: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    postEvent: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    postEventText: { marginTop: 0, flexShrink: 1 },
    postDate: { fontSize: 11, color: colors.textSecondary },
    postContent: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 12 },
    postFooter: { flexDirection: 'row', gap: 14 },
    postStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
    reviewSubmitInner: { paddingVertical: 12, alignItems: 'center', backgroundColor: colors.primary },
    reviewSubmitText: { color: '#fff', fontWeight: '800', fontSize: 14 },

    // YORUM LİSTESİ
    reviewCard: {
      borderRadius: 14, borderWidth: 1, padding: 14,
      marginBottom: 10,
    },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    reviewAvatar: {
      width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    reviewAvatarText: { color: colors.text, fontWeight: '800', fontSize: 14 },
    reviewMeta: { flex: 1, gap: 3 },
    reviewUsername: { fontSize: 13, fontWeight: '700' },
    reviewDate: { fontSize: 11 },
    reviewComment: { fontSize: 14, lineHeight: 20 },

    // BOŞ
    empty: { alignItems: 'center', paddingVertical: 56 },
    emptyIcon: { marginBottom: 14 },
    emptyText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
    emptySubText: { fontSize: 13, marginTop: 6 },

    // SON KONSERLER
    pastSection: { marginTop: 24 },
    pastSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    pastSectionLine: { flex: 1, height: 1 },
    pastSectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, },
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
