import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Alert, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { artistId, artistName } = route.params;

  const [artist, setArtist] = useState(null);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('events');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAll();
  }, [artistId]);

  const fetchAll = async () => {
    try {
      const [artistRes, eventsRes, postsRes] = await Promise.all([
        API.get(`/artists/${artistId}?currentUserId=${global.userId}`),
        API.get(`/artists/${artistId}/events`),
        API.get(`/artists/${artistId}/posts`),
      ]);
      setArtist(artistRes.data);
      setFollowing(artistRes.data.isFollowedByCurrentUser || false);
      setEvents(eventsRes.data);
      setPosts(postsRes.data);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      console.log('Sanatçı hatası:', err.message);
      Alert.alert('Hata', 'Sanatçı profili yüklenemedi.');
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
        await API.delete(`/artists/${artistId}/follow?userId=${global.userId}`);
        setArtist(prev => ({
          ...prev,
          followerCount: Math.max(0, (prev.followerCount || 1) - 1),
        }));
      } else {
        await API.post(`/artists/${artistId}/follow?userId=${global.userId}`);
        setArtist(prev => ({
          ...prev,
          followerCount: (prev.followerCount || 0) + 1,
        }));
      }
    } catch (err) {
      setFollowing(wasFollowing);
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
    } finally {
      setFollowLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'events' ? 0 : 1,
      tension: 70, friction: 10, useNativeDriver: false,
    }).start();
  };

  const tabIndicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

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
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={styles.hero}>

        {/* Dekoratif arka plan dairesi */}
        <View style={styles.heroBgCircle} />

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.heroInner, { transform: [{ scale: scaleAnim }] }]}>
          {/* AVATAR */}
          {artist?.imageUrl ? (
            <Image source={{ uri: artist.imageUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {(artistName || artist?.name || '?').charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}

          {/* MİKROFON BADGE */}
          <View style={styles.micBadge}>
            <Text style={styles.micEmoji}>🎤</Text>
          </View>

          <Text style={styles.artistName}>{artist?.name || artistName}</Text>

          {/* STATS */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{artist?.followerCount || 0}</Text>
              <Text style={styles.statLabel}>Takipçi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{events.length}</Text>
              <Text style={styles.statLabel}>Etkinlik</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Post</Text>
            </View>
          </View>

          {/* TAKİP BUTONU */}
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
                  : <Text style={styles.followingText}>✓ Takip Ediliyor</Text>
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
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.followText}>+ Takip Et</Text>
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
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('events')}>
            <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
              🎪 Etkinlikler ({events.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('posts')}>
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              🔥 Postlar ({posts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── İÇERİK ──────────────────────────────────────────────────────── */}
      <View style={styles.content}>

        {activeTab === 'events' ? (
          events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎭</Text>
              <Text style={styles.emptyText}>Henüz etkinlik yok</Text>
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
                      <Text style={styles.eventDate}>
                        📅 {new Date(item.eventDate).toLocaleDateString('tr-TR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                      {item.venueCity && (
                        <Text style={styles.eventCity}>📍 {item.venueCity}</Text>
                      )}
                    </View>
                    <View style={[
                      styles.approvedDot,
                      { backgroundColor: item.isApproved ? '#00D4AA' : '#F5A623' },
                    ]} />
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>Bu sanatçı için henüz post yok</Text>
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

    // HERO
    hero: {
      paddingTop: 56,
      paddingBottom: 32,
      paddingHorizontal: 24,
      overflow: 'hidden',
      position: 'relative',
    },
    heroBgCircle: {
      position: 'absolute',
      width: 300, height: 300,
      borderRadius: 150,
      backgroundColor: '#E9456015',
      top: -80, right: -80,
    },
    backButton: { marginBottom: 24 },
    backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },

    heroInner: { alignItems: 'center' },

    avatar: {
      width: 110, height: 110, borderRadius: 55,
      borderWidth: 3, borderColor: colors.border,
      marginBottom: 6,
    },
    avatarPlaceholder: {
      width: 110, height: 110, borderRadius: 55,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 6,
    },
    avatarLetter: { fontSize: 46, fontWeight: 'bold', color: '#fff' },

    micBadge: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.card,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: colors.border,
      marginBottom: 12,
      marginTop: -16,
    },
    micEmoji: { fontSize: 14 },

    artistName: {
      fontSize: 26, fontWeight: 'bold',
      color: colors.text, marginBottom: 20,
      textAlign: 'center',
    },

    // STATS
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 24,
      gap: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
    },
    stat: { alignItems: 'center', flex: 1 },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
    statDivider: { width: 1, height: 32, backgroundColor: colors.border },

    // TAKİP BUTONU
    followWrapper: { width: '100%' },
    followButton: {
      paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    },
    followText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    followingButton: {
      paddingVertical: 14, borderRadius: 14, alignItems: 'center',
      borderWidth: 2, borderColor: colors.primary,
    },
    followingText: { color: colors.primary, fontWeight: 'bold', fontSize: 15 },

    // SEKMELER
    tabBarWrapper: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 4,
      position: 'relative',
      overflow: 'hidden',
    },
    tabIndicator: {
      position: 'absolute',
      top: 4, bottom: 4,
      width: '50%',
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', zIndex: 1 },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: '#fff' },

    // İÇERİK
    content: { padding: 16, paddingBottom: 32 },

    // ETKİNLİK GRİD
    eventGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    },
    eventCard: {
      width: CARD_WIDTH, borderRadius: 18, overflow: 'hidden',
    },
    eventCardGradient: {
      padding: 14, minHeight: 160,
      justifyContent: 'space-between',
      position: 'relative',
    },
    eventEmoji: { fontSize: 32, marginBottom: 8 },
    eventCardBody: { flex: 1 },
    eventName: {
      fontSize: 13, fontWeight: 'bold',
      color: '#fff', marginBottom: 6,
    },
    eventDate: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginBottom: 3 },
    eventCity: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
    approvedDot: {
      position: 'absolute', top: 10, right: 10,
      width: 8, height: 8, borderRadius: 4,
    },

    // POST KARTI
    postCard: {
      backgroundColor: colors.card,
      borderRadius: 16, padding: 16,
      marginBottom: 12,
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
    postAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    postHeaderInfo: { flex: 1 },
    postUsername: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    postEvent: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    postDate: { fontSize: 11, color: colors.textSecondary },
    postContent: {
      fontSize: 14, color: colors.text,
      lineHeight: 20, marginBottom: 12,
    },
    postFooter: { flexDirection: 'row', gap: 14 },
    postStat: { fontSize: 13, color: colors.textSecondary },

    // BOŞ
    empty: { alignItems: 'center', paddingVertical: 56 },
    emptyEmoji: { fontSize: 52, marginBottom: 14 },
    emptyText: { color: colors.textSecondary, fontSize: 15 },
  });
}