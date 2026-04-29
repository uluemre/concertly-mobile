import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Image,
  Animated, Dimensions, Alert
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

export default function UserProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userId } = route.params;

  const [profile, setProfile]       = useState(null);
  const [posts, setPosts]           = useState([]);
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [following, setFollowing]   = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab]   = useState('posts');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Kendi profilimse ProfileScreen'e yönlendir
  const isOwnProfile = global.userId === userId;

  useEffect(() => {
    fetchAll();
  }, [userId]);

  const fetchAll = async () => {
    try {
      const [profileRes, postsRes, eventsRes] = await Promise.all([
        API.get(`/users/${userId}/profile?currentUserId=${global.userId}`),
        API.get(`/users/${userId}/posts`),
        API.get(`/users/${userId}/events`),
      ]);

      setProfile(profileRes.data);
      setFollowing(profileRes.data.followedByCurrentUser || false);
      setPosts(postsRes.data);
      setEvents(eventsRes.data);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      console.log('Profil hatası:', err.message);
      Alert.alert('Hata', 'Profil yüklenemedi.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true);

    const wasFollowing = following;
    setFollowing(!wasFollowing); // Optimistic update

    try {
      if (wasFollowing) {
        await API.delete(`/users/${userId}/follow?followerId=${global.userId}`);
        setProfile(prev => ({
          ...prev,
          followerCount: Math.max(0, (prev.followerCount || 1) - 1),
        }));
      } else {
        await API.post(`/users/${userId}/follow?followerId=${global.userId}`);
        setProfile(prev => ({
          ...prev,
          followerCount: (prev.followerCount || 0) + 1,
        }));
      }
    } catch (err) {
      setFollowing(wasFollowing); // Geri al
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
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
      {/* HERO */}
      <LinearGradient
        colors={['#1A1A2E', '#0F0F1A']}
        style={styles.hero}
      >
        {/* GERİ BUTONU */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>

        <Animated.View
          style={[styles.heroInner, { transform: [{ scale: scaleAnim }] }]}
        >
          {/* AVATAR */}
          {profile?.profileImageUrl ? (
            <Image
              source={{ uri: profile.profileImageUrl }}
              style={styles.avatar}
            />
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

          <Text style={styles.username}>@{profile?.username}</Text>

          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Text style={styles.bioEmpty}>Bio henüz eklenmemiş</Text>
          )}

          {/* STATS */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Post</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{profile?.followerCount || 0}</Text>
              <Text style={styles.statLabel}>Takipçi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{profile?.followingCount || 0}</Text>
              <Text style={styles.statLabel}>Takip</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{events.length}</Text>
              <Text style={styles.statLabel}>Etkinlik</Text>
            </View>
          </View>

          {/* TAKİP BUTONU */}
          {!isOwnProfile && (
            <TouchableOpacity
              onPress={handleFollowToggle}
              disabled={followLoading}
              style={styles.followButtonWrapper}
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
          )}
        </Animated.View>
      </LinearGradient>

      {/* SEKMELER */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            🎵 Postlar ({posts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            🎪 Etkinlikler ({events.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* İÇERİK */}
      <View style={styles.content}>
        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>Henüz post yok</Text>
            </View>
          ) : (
            posts.map((item, index) => (
              <View key={item.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Text style={styles.postEventName}>🎵 {item.eventName || 'Etkinlik'}</Text>
                  <Text style={styles.postDate}>
                    {new Date(item.createdAt).toLocaleDateString('tr-TR')}
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
        ) : (
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
                    <Text style={styles.eventEmoji}>🎪</Text>
                    <Text style={styles.eventName} numberOfLines={2}>{item.name}</Text>
                    {item.artistName && (
                      <Text style={styles.eventArtist}>🎤 {item.artistName}</Text>
                    )}
                    <Text style={styles.eventDate}>
                      📅 {new Date(item.eventDate).toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'short'
                      })}
                    </Text>
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

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: colors.background,
  },

  // HERO
  hero: {
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  backButton: { marginBottom: 20 },
  backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },

  heroInner: { alignItems: 'center' },

  avatar: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: colors.border,
    marginBottom: 14,
  },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  avatarLetter: { fontSize: 40, fontWeight: 'bold', color: '#fff' },

  username: {
    fontSize: 22, fontWeight: 'bold',
    color: colors.text, marginBottom: 8,
  },
  bio: {
    fontSize: 14, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
    marginBottom: 20, paddingHorizontal: 16,
  },
  bioEmpty: {
    fontSize: 13, color: '#3A3A5A',
    marginBottom: 20, fontStyle: 'italic',
  },

  // STATS
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },

  // TAKİP BUTONU
  followButtonWrapper: { width: '100%' },
  followButton: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  followText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  followingButton: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  followingText: { color: colors.primary, fontWeight: 'bold', fontSize: 15 },

  // SEKMELER
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary },

  // İÇERİK
  content: { padding: 16, paddingBottom: 32 },

  // POST
  postCard: {
    backgroundColor: colors.card,
    borderRadius: 16, padding: 16,
    marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  postHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  postEventName: { fontSize: 13, color: colors.primary, fontWeight: '700', flex: 1 },
  postDate: { fontSize: 11, color: colors.textSecondary },
  postContent: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 12 },
  postFooter: { flexDirection: 'row', gap: 14 },
  postStat: { fontSize: 13, color: colors.textSecondary },

  // ETKİNLİK GRİD
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  eventCard: { width: CARD_WIDTH, borderRadius: 16, overflow: 'hidden' },
  eventCardGradient: { padding: 14, minHeight: 140, justifyContent: 'flex-end' },
  eventEmoji: { fontSize: 28, marginBottom: 8 },
  eventName: { fontSize: 13, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  eventArtist: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  eventDate: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  // BOŞ
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyText: { color: colors.textSecondary, fontSize: 15 },
});
