import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Image,
  Animated, Dimensions, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EventCard from '../components/EventCard';
import API from '../services/api';
import DeepLinkLoader from '../components/DeepLinkLoader';
import { useTheme } from '../theme';
import { ProfileSkeletonPage } from '../components/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { parseEventDate, dateLocale } from '../utils/time';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { hapticLight } from '../utils/haptics';
import { usePostUpdates } from '../services/postUpdates';
import { apiErrorMessage, isPrivateAccountError } from '../utils/communityErrors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

function UserProfileContent({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t, tu, lang } = useLanguage();
  const { userId } = route.params;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  // PostDetail'de değişen beğeni / yorum sayıları geri dönünce burada da görünsün
  usePostUpdates(setPosts);
  const [events, setEvents] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // 'NONE' | 'PENDING' | 'ACCEPTED' (gizli hesapta takip isteği beklemede olabilir)
  const [followStatus, setFollowStatus] = useState('NONE');
  const [followLoading, setFollowLoading] = useState(false);
  // Gizli hesabın içeriği bu görüntüleyiciye kapalı (alt uç noktalar 403 PRIVATE_ACCOUNT döndü)
  const [locked, setLocked] = useState(false);
  // Eski bir yanıtın daha yeni durumu ezmemesi için istek sırası
  const fetchSeq = useRef(0);
  const followBusy = useRef(false);
  const [activeTab, setActiveTab] = useState('posts');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const isOwnProfile = session.userId === userId;

  useEffect(() => {
    // Kendi profilimse ProfileScreen'e yönlendir
    if (isOwnProfile) {
      navigation.replace('MainApp', { screen: 'Profile' });
      return;
    }
    fetchAll();
  }, [userId]);

  const fetchAll = async (refresh = false) => {
    const seq = ++fetchSeq.current;
    try {
      // allSettled: gizli hesapta alt uçlar 403 döner, profil başlığı yine de gösterilir
      const [profileRes, postsRes, eventsRes, artistsRes] = await Promise.allSettled([
        API.get(`/users/${userId}/profile?currentUserId=${session.userId}`),
        API.get(`/users/${userId}/posts`),
        API.get(`/users/${userId}/events`),
        API.get(`/users/${userId}/followed-artists`),
      ]);
      if (seq !== fetchSeq.current) return;
      if (profileRes.status !== 'fulfilled') throw profileRes.reason;

      const subResults = [postsRes, eventsRes, artistsRes];
      const isLocked = subResults.some(r => r.status === 'rejected' && isPrivateAccountError(r.reason));
      const profileData = profileRes.value.data;
      setProfile(profileData);
      setFollowStatus(profileData.followStatus || (profileData.isFollowedByCurrentUser ? 'ACCEPTED' : 'NONE'));
      setLocked(isLocked);
      setPosts(postsRes.status === 'fulfilled' ? postsRes.value.data : []);
      setEvents(eventsRes.status === 'fulfilled' ? eventsRes.value.data : []);
      setFollowedArtists(artistsRes.status === 'fulfilled' ? artistsRes.value.data : []);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 350, useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      // Eskiden uyarı + goBack yapılıyordu; doğrudan açılan linkte geri gidilemediği
      // için boş bir profil kalıyordu
      if (seq !== fetchSeq.current) return;
      console.log('profile fetch error:', err.message);
      // Takip işleminden sonraki yenilemede hata, açık profili "bulunamadı"ya çevirmesin
      if (!refresh) setNotFound(true);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  };

  const runFollowAction = async (request, optimisticStatus) => {
    if (followBusy.current) return;
    followBusy.current = true;
    setFollowLoading(true);
    const previousStatus = followStatus;
    setFollowStatus(optimisticStatus);
    try {
      await request();
      // Gerçek durum (PENDING / ACCEPTED), sayılar ve içerik kilidi sunucudan okunur
      await fetchAll(true);
    } catch (err) {
      setFollowStatus(previousStatus);
      Alert.alert(t('error'), apiErrorMessage(err, t, 'userprofile_action_error'));
    } finally {
      followBusy.current = false;
      setFollowLoading(false);
    }
  };

  const handleFollowToggle = () => {
    if (followBusy.current) return;
    hapticLight();
    if (followStatus === 'ACCEPTED') {
      runFollowAction(() => API.delete(`/users/${userId}/follow?followerId=${session.userId}`), 'NONE');
    } else if (followStatus === 'PENDING') {
      Alert.alert(t('user_profile_cancel_request_title'), null, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('user_profile_cancel_request_btn'), style: 'destructive',
          onPress: () => runFollowAction(() => API.delete(`/users/${userId}/follow?followerId=${session.userId}`), 'NONE'),
        },
      ]);
    } else {
      runFollowAction(
        () => API.post(`/users/${userId}/follow?followerId=${session.userId}`),
        profile?.isPrivate ? 'PENDING' : 'ACCEPTED',
      );
    }
  };

  const submitReport = async (reason) => {
    try {
      await API.post('/reports', { targetType: 'USER', targetId: userId, reason });
      Alert.alert(t('mod_reported_title'), t('mod_reported_msg'));
    } catch {
      Alert.alert('', t('mod_error'));
    }
  };

  const handleModeration = () => {
    Alert.alert(t('mod_options_title'), profile ? `@${profile.username}` : null, [
      {
        text: t('mod_report'), onPress: () => Alert.alert(t('mod_reason_title'), null, [
          { text: t('mod_reason_spam'), onPress: () => submitReport('SPAM') },
          { text: t('mod_reason_harassment'), onPress: () => submitReport('HARASSMENT') },
          { text: t('mod_reason_inappropriate'), onPress: () => submitReport('INAPPROPRIATE') },
          { text: t('mod_cancel'), style: 'cancel' },
        ]),
      },
      {
        text: t('mod_block'), style: 'destructive', onPress: () => Alert.alert(t('mod_block_title'), t('mod_block_msg'), [
          { text: t('mod_cancel'), style: 'cancel' },
          {
            text: t('mod_block'), style: 'destructive', onPress: async () => {
              try {
                await API.post(`/users/${userId}/block`);
                Alert.alert('', t('mod_blocked_msg'));
                goBackOrFallback(navigation);
              } catch {
                Alert.alert('', t('mod_error'));
              }
            },
          },
        ]),
      },
      { text: t('mod_cancel'), style: 'cancel' },
    ]);
  };

  if (notFound) return <DeepLinkLoader error onBack={() => navigation.navigate('MainApp')} />;
  if (loading) return <ProfileSkeletonPage />;

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <View style={styles.hero}>

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => goBackOrFallback(navigation)} accessibilityRole="button">
            <Text style={styles.backText}>{t('back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleModeration} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('mod_options_title')}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} style={styles.moreText} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.heroInner, { transform: [{ scale: scaleAnim }] }]}>

          {/* Sol: AVATAR */}
          <View style={styles.avatarCol}>
            {profile?.profileImageUrl ? (
              <Image source={{ uri: profile.profileImageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {profile?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>

          {/* Sağ: BİLGİ + BUTONLAR */}
          <View style={styles.infoCol}>
            <Text style={styles.username} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>@{profile?.username}</Text>
            {profile?.bio ? (
              <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
            ) : (
              <Text style={styles.bioEmpty}>{t('userprofile_bio_empty')}</Text>
            )}

            {/* TAKİP + MESAJ BUTONLARI */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleFollowToggle}
                disabled={followLoading}
                style={styles.followButtonWrapper}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: followStatus !== 'NONE', busy: followLoading }}
              >
                {followStatus !== 'NONE' ? (
                  <View style={styles.followingButton}>
                    {followLoading
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={styles.followingText}>
                          {followStatus === 'PENDING' ? t('user_profile_requested') : t('user_profile_following')}
                        </Text>
                    }
                  </View>
                ) : (
                  <View style={[styles.followButton, { backgroundColor: colors.primary }]}>
                    {followLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.followText}>
                          {profile?.isPrivate ? t('user_profile_follow_request') : t('user_profile_follow')}
                        </Text>
                    }
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('Chat', {
                  userId,
                  username: profile?.username,
                  profileImageUrl: profile?.profileImageUrl,
                })}
                style={styles.messageButtonWrapper}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {/* İkincil eylem: düz kart + kenarlık */}
                <View style={[styles.followButton, styles.messageButton]}>
                  <Ionicons name="chatbubble-outline" size={15} color={colors.text} />
                  <Text style={[styles.followText, { color: colors.text }]}>{t('profile_message_btn')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

        </Animated.View>

        {/* STATS */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{locked ? '—' : posts.length}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tu('profile_post_count')}</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.stat}
            onPress={() => navigation.navigate('FollowList', { userId, type: 'followers' })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${profile?.followerCount || 0} ${t('profile_followers')}`}
          >
            <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{profile?.followerCount || 0}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tu('profile_followers')}</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.stat}
            onPress={() => navigation.navigate('FollowList', { userId, type: 'following' })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${profile?.followingCount || 0} ${t('profile_following')}`}
          >
            <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{profile?.followingCount || 0}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tu('profile_following')}</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{locked ? '—' : events.length}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tu('profile_event_count')}</Text>
          </View>
        </View>
      </View>

      {/* ── TAKİP ETTİĞİ SANATÇILAR ──────────────────────────────────────── */}
      {followedArtists.length > 0 && (
        <View style={styles.followedSection}>
          <Text style={styles.followedTitle}>{tu('userprofile_followed_artists')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.followedRow}
          >
            {followedArtists.map(a => (
              <TouchableOpacity
                key={a.id}
                style={styles.followedItem}
                onPress={() => navigation.navigate('ArtistProfile', { artistId: a.id, artistName: a.name })}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={a.name}
              >
                {a.imageUrl ? (
                  <Image source={{ uri: a.imageUrl }} style={styles.followedAvatar} />
                ) : (
                  <View style={styles.followedAvatarPlaceholder}>
                    <Text style={styles.followedAvatarLetter}>
                      {(a.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.followedName} numberOfLines={1}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {locked ? (
        <View style={styles.lockCard}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.textSecondary} style={styles.lockEmoji} />
          <Text style={styles.lockTitle}>{t('private_account_locked_title')}</Text>
          <Text style={styles.lockText}>{t('private_account_locked_msg')}</Text>
        </View>
      ) : (<>
      {/* ── SEKMELER (ikon + sayı) ──────────────────────────────────────── */}
      <View style={styles.tabs}>
        {[
          { key: 'posts',  icon: 'document-text-outline', label: t('profile_tab_posts'), count: posts.length },
          { key: 'events', icon: 'ticket-outline', label: t('profile_tab_events'), count: events.length },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
            accessibilityLabel={`${tab.label}: ${tab.count}`}
          >
            <Ionicons name={tab.icon} size={20} color={activeTab === tab.key ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabCount, activeTab === tab.key && styles.tabCountActive]}>
              {tab.count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── İÇERİK ───────────────────────────────────────────────────────── */}
      <View style={styles.content}>

        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={52} color={colors.textSecondary} style={styles.emptyEmoji} />
              <Text style={styles.emptyText}>{t('userprofile_no_posts')}</Text>
            </View>
          ) : (
            posts.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.postCard}
                // Karta dokunmak her zaman gönderinin kendisini açar. Genel gönderide
                // eventId yok; eskiden EventDetail'e null id ile gidiliyordu (500 +
                // "Invalid Date"). Yalnızca postId geçilir: nesne geçilirse web
                // URL'sine "?post=[object Object]" olarak yazılıyor.
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                activeOpacity={0.85}
              >
                {/* POST BAŞLIĞI */}
                <View style={styles.postHeader}>
                  <View style={styles.postAvatar}>
                    <Text style={styles.postAvatarText}>
                      {profile?.username?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.postHeaderInfo}>
                    {/* Etkinlik satırı yalnızca konsere bağlı gönderide; ayrıca tıklanır */}
                    {item.eventId ? (
                      <TouchableOpacity
                        onPress={() => openEvent(navigation, item.eventId)}
                        hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.inlineRow}>
                          <Ionicons name="musical-notes-outline" size={12} color={colors.primary} />
                          <Text style={[styles.postEventName, { flexShrink: 1 }]} numberOfLines={1}>
                            {item.eventName || t('event_generic')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : null}
                    <Text style={styles.postDate}>
                      {new Date(item.createdAt).toLocaleDateString(dateLocale(lang), {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>

                {/* İÇERİK */}
                <Text style={styles.postContent}>{item.content}</Text>

                {/* ALT KISIM */}
                <View style={styles.postFooter}>
                  <View style={styles.inlineRow}>
                    <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.postStat}>{item.likeCount || 0}</Text>
                  </View>
                  <View style={styles.inlineRow}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.postStat}>{item.commentCount || 0}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          events.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={52} color={colors.textSecondary} style={styles.emptyEmoji} />
              <Text style={styles.emptyText}>{t('userprofile_no_events')}</Text>
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
          )
        )}

      </View>
      </>)}
    </Animated.ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: {
      flex: 1, justifyContent: 'center',
      alignItems: 'center', backgroundColor: colors.background,
    },

    // HERO — ArtistProfile ile aynı dizayn
    hero: { paddingTop: 56, paddingBottom: 32, paddingHorizontal: 24, overflow: 'hidden', position: 'relative' },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    backButton: {},
    backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
    moreText: { paddingHorizontal: 4 },
    heroInner: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 16 },
    avatarCol: { alignItems: 'center' },
    infoCol: { flex: 1, paddingTop: 2 },

    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.border },
    avatarPlaceholder: {
      width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 3, borderColor: colors.border,
    },
    avatarLetter: { fontSize: 44, fontWeight: '900', color: colors.text },

    username: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 6, lineHeight: 27 },
    bio: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 },
    bioEmpty: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 8, fontStyle: 'italic' },

    // STATS — ArtistProfile ile aynı
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

    // BUTONLAR — ArtistProfile heroActions ile aynı
    actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
    followButtonWrapper: { flex: 1 },
    messageButtonWrapper: { flex: 1 },
    followButton: { paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    messageButton: {
      flexDirection: 'row', justifyContent: 'center', gap: 6,
      backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
    },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    followText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    followingButton: {
      paddingVertical: 10, borderRadius: 12, alignItems: 'center',
      borderWidth: 2, borderColor: colors.primary,
    },
    followingText: { color: colors.primary, fontWeight: 'bold', fontSize: 14 },

    // TAKİP ETTİĞİ SANATÇILAR
    followedSection: { marginTop: 16, marginBottom: 4 },
    followedTitle: {
      fontSize: 13, fontWeight: '700', color: colors.text,
      paddingHorizontal: 16, marginBottom: 12, letterSpacing: 0.5,
    },
    followedRow: { paddingHorizontal: 16, gap: 16 },
    followedItem: { alignItems: 'center', width: 64 },
    followedAvatar: {
      width: 60, height: 60, borderRadius: 30,
      borderWidth: 2, borderColor: colors.primary, marginBottom: 6,
    },
    followedAvatarPlaceholder: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    },
    followedAvatarLetter: { fontSize: 24, fontWeight: '800', color: colors.primary },
    followedName: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },

    // SEKMELER (emoji + sayı, profil ekranıyla aynı)
    tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', gap: 3, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.primary },
    tabCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    tabCountActive: { color: colors.text },

    // GİZLİ HESAP KİLİDİ
    lockCard: {
      alignItems: 'center', margin: 16, padding: 28, borderRadius: 16,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    lockEmoji: { marginBottom: 10 },
    lockTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
    lockText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

    // İÇERİK
    content: { padding: 16, paddingBottom: 32 },

    // POST KARTI
    postCard: {
      backgroundColor: colors.card,
      borderRadius: 16, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    postHeader: {
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 12, gap: 10,
    },
    postAvatar: {
      width: 40, height: 40, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    postAvatarText: { color: colors.text, fontWeight: 'bold', fontSize: 16 },
    postHeaderInfo: { flex: 1 },
    postEventName: { fontSize: 13, color: colors.primary, fontWeight: '700' },
    postDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    postContent: {
      fontSize: 14, color: colors.text,
      lineHeight: 20, marginBottom: 12,
    },
    postFooter: { flexDirection: 'row', gap: 14 },
    postStat: { fontSize: 13, color: colors.textSecondary },

    // ETKİNLİK GRİD
    eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    eventTile: { width: CARD_WIDTH, marginBottom: 0 },
    eventCard: { width: CARD_WIDTH, borderRadius: 16, overflow: 'hidden' },
    eventCardGradient: {
      padding: 14, minHeight: 150, justifyContent: 'space-between',
    },
    eventEmoji: { fontSize: 28, marginBottom: 8 },
    eventCardBody: { flex: 1 },
    eventName: {
      fontSize: 13, fontWeight: 'bold',
      color: '#fff', marginBottom: 6,
    },
    eventArtist: {
      fontSize: 11, color: 'rgba(255,255,255,0.9)',
      marginBottom: 4, textDecorationLine: 'underline',
    },
    eventDate: {
      fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600',
    },

    // BOŞ
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyEmoji: { marginBottom: 14 },
    emptyText: { color: colors.textSecondary, fontSize: 15 },
  });
}

/**
 * Paylaşım linki kullanıcı ADIYLA gelir (/u/emre) — okunabilir olsun diye.
 * Ekran id ile çalıştığı için adı burada id'ye çeviriyoruz.
 */
export default function UserProfileScreen({ route, navigation }) {
  const { userId, username } = route.params || {};
  // Link yapılandırması (user/:userId) /u/<ad> ve /user/<ad> linklerinde kullanıcı
  // ADINI da userId parametresine koyar. Eskiden Number("emre") → NaN olup
  // doğrudan "İçerik bulunamadı" gösteriliyordu. Tamamen rakamsa id (eski linkler
  // ve uygulama içi gezinme), değilse kullanıcı adı olarak çözülür.
  const raw = userId !== undefined && userId !== null ? String(userId).trim() : '';
  const isNumericId = /^\d+$/.test(raw);
  const lookupName = username || (!isNumericId && raw ? raw : null);
  const [resolvedId, setResolvedId] = useState(isNumericId ? Number(raw) : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (resolvedId || !lookupName) return;
    let cancelled = false;
    API.get(`/users/by-username/${encodeURIComponent(lookupName)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.id) setResolvedId(res.data.id);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [lookupName, resolvedId]);

  if (!resolvedId) {
    return <DeepLinkLoader error={failed || !lookupName} onBack={() => navigation.navigate('MainApp')} />;
  }
  return (
    <UserProfileContent
      route={{ ...route, params: { ...route.params, userId: resolvedId } }}
      navigation={navigation}
    />
  );
}
