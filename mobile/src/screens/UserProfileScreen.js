import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Image,
  Animated, Dimensions, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const gradientSets = [
  ['#E94560', '#7C3AED'],
  ['#F5A623', '#E94560'],
  ['#00D4AA', '#7C3AED'],
  ['#7C3AED', '#F5A623'],
];

const eventEmojis = ['🎸', '🎤', '🥁', '🎹', '🎺', '🎻', '🎪', '🎭'];

export default function UserProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();
  const { userId } = route.params;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
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

  const fetchAll = async () => {
    try {
      const [profileRes, postsRes, eventsRes, artistsRes] = await Promise.all([
        API.get(`/users/${userId}/profile?currentUserId=${session.userId}`),
        API.get(`/users/${userId}/posts`),
        API.get(`/users/${userId}/events`),
        API.get(`/users/${userId}/followed-artists`),
      ]);

      setProfile(profileRes.data);
      setFollowing(profileRes.data.isFollowedByCurrentUser || false);
      setPosts(postsRes.data);
      setEvents(eventsRes.data);
      setFollowedArtists(artistsRes.data);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 350, useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      console.log('profile fetch error:', err.message);
      Alert.alert(t('error'), t('userprofile_load_error'));
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
        await API.delete(`/users/${userId}/follow?followerId=${session.userId}`);
        setProfile(prev => ({
          ...prev,
          followerCount: Math.max(0, (prev.followerCount || 1) - 1),
        }));
      } else {
        await API.post(`/users/${userId}/follow?followerId=${session.userId}`);
        setProfile(prev => ({
          ...prev,
          followerCount: (prev.followerCount || 0) + 1,
        }));
      }
    } catch (err) {
      setFollowing(wasFollowing);
      Alert.alert(t('error'), t('userprofile_action_error'));
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <LinearGradient colors={colors.headerGradient} style={styles.hero}>
        <View style={styles.heroBgCircle} />

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.heroInner, { transform: [{ scale: scaleAnim }] }]}>

          {/* Sol: AVATAR */}
          <View style={styles.avatarCol}>
            {profile?.profileImageUrl ? (
              <Image source={{ uri: profile.profileImageUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#E94560', '#7C3AED']}
                style={styles.avatarPlaceholder}
              >
                <Text style={styles.avatarLetter}>
                  {profile?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </LinearGradient>
            )}
          </View>

          {/* Sağ: BİLGİ + BUTONLAR */}
          <View style={styles.infoCol}>
            <Text style={styles.username} numberOfLines={1}>@{profile?.username}</Text>
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
              >
                {following ? (
                  <View style={styles.followingButton}>
                    {followLoading
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={styles.followingText}>{t('user_profile_following')}</Text>
                    }
                  </View>
                ) : (
                  <LinearGradient
                    colors={['#E94560', '#7C3AED']}
                    style={styles.followButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {followLoading
                      ? <ActivityIndicator size="small" color={colors.text} />
                      : <Text style={styles.followText}>{t('user_profile_follow')}</Text>
                    }
                  </LinearGradient>
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
              >
                <LinearGradient
                  colors={['#3B82F6', '#00D4AA']}
                  style={styles.followButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.followText}>{t('profile_message_btn')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

        </Animated.View>

        {/* STATS */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>{t('profile_post_count')}</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.stat}
            onPress={() => navigation.navigate('FollowList', { userId, type: 'followers' })}
            activeOpacity={0.7}
          >
            <Text style={styles.statNumber}>{profile?.followerCount || 0}</Text>
            <Text style={styles.statLabel}>{t('profile_followers')}</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.stat}
            onPress={() => navigation.navigate('FollowList', { userId, type: 'following' })}
            activeOpacity={0.7}
          >
            <Text style={styles.statNumber}>{profile?.followingCount || 0}</Text>
            <Text style={styles.statLabel}>{t('profile_following')}</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{events.length}</Text>
            <Text style={styles.statLabel}>{t('profile_event_count')}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── TAKİP ETTİĞİ SANATÇILAR ──────────────────────────────────────── */}
      {followedArtists.length > 0 && (
        <View style={styles.followedSection}>
          <Text style={styles.followedTitle}>{t('userprofile_followed_artists')}</Text>
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

      {/* ── SEKMELER (emoji + sayı) ──────────────────────────────────────── */}
      <View style={styles.tabs}>
        {[
          { key: 'posts',  icon: '📝', count: posts.length },
          { key: 'events', icon: '🎫', count: events.length },
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

      {/* ── İÇERİK ───────────────────────────────────────────────────────── */}
      <View style={styles.content}>

        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>{t('userprofile_no_posts')}</Text>
            </View>
          ) : (
            posts.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.postCard}
                onPress={() => navigation.navigate('EventDetail', { event: { id: item.eventId, name: item.eventName } })}
                activeOpacity={0.85}
              >
                {/* POST BAŞLIĞI */}
                <View style={styles.postHeader}>
                  <LinearGradient
                    colors={gradientSets[index % gradientSets.length]}
                    style={styles.postAvatar}
                  >
                    <Text style={styles.postAvatarText}>
                      {profile?.username?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </LinearGradient>
                  <View style={styles.postHeaderInfo}>
                    <Text style={styles.postEventName} numberOfLines={1}>
                      🎵 {item.eventName || 'Etkinlik'}
                    </Text>
                    <Text style={styles.postDate}>
                      {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>

                {/* İÇERİK */}
                <Text style={styles.postContent}>{item.content}</Text>

                {/* ALT KISIM */}
                <View style={styles.postFooter}>
                  <Text style={styles.postStat}>❤️ {item.likeCount || 0}</Text>
                  <Text style={styles.postStat}>💬 {item.commentCount || 0}</Text>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : (
          events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎭</Text>
              <Text style={styles.emptyText}>{t('userprofile_no_events')}</Text>
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
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.eventEmoji}>
                      {eventEmojis[index % eventEmojis.length]}
                    </Text>
                    <View style={styles.eventCardBody}>
                      <Text style={styles.eventName} numberOfLines={2}>{item.name}</Text>
                      {/* Sanatçıya tıklayınca ArtistProfile'a git ✅ */}
                      {item.artistName && (
                        <TouchableOpacity
                          onPress={() => {
                            navigation.navigate('ArtistProfile', {
                              artistId: item.artistId,
                              artistName: item.artistName,
                            });
                          }}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        >
                          <Text style={styles.eventArtist}>🎤 {item.artistName}</Text>
                        </TouchableOpacity>
                      )}
                      <Text style={styles.eventDate}>
                        📅 {new Date(item.eventDate).toLocaleDateString('tr-TR', {
                          day: 'numeric', month: 'short',
                        })}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

      </View>
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
    heroBgCircle: {
      position: 'absolute', width: 300, height: 300, borderRadius: 150,
      backgroundColor: colors.primary + '15', top: -80, right: -80,
    },
    backButton: { marginBottom: 24 },
    backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
    heroInner: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 16 },
    avatarCol: { alignItems: 'center' },
    infoCol: { flex: 1, paddingTop: 2 },

    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.border },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { fontSize: 44, fontWeight: '900', color: 'rgba(255,255,255,0.95)' },

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
      paddingHorizontal: 16, marginBottom: 12,
      textTransform: 'uppercase', letterSpacing: 0.5,
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
    tabIcon: { fontSize: 20 },
    tabCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    tabCountActive: { color: colors.text },

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
    emptyEmoji: { fontSize: 52, marginBottom: 14 },
    emptyText: { color: colors.textSecondary, fontSize: 15 },
  });
}