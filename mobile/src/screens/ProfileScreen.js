import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
  Alert, Image, Animated, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
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

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [])
  );

  const fetchAll = async () => {
    if (!global.userId) return;
    try {
      const [profileRes, postsRes, eventsRes] = await Promise.all([
        API.get(`/users/${global.userId}/profile`),
        API.get(`/users/${global.userId}/posts`),
        API.get(`/users/${global.userId}/events`),
      ]);
      setProfile(profileRes.data);
      setPosts(postsRes.data);
      setEvents(eventsRes.data);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.log('Profil hatası:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri erişimine izin vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      setUploadingPhoto(true);
      try {
        await API.put(`/users/${global.userId}/profile`, {
          profileImageUrl: localUri,
        });
        setProfile(prev => ({ ...prev, profileImageUrl: localUri }));
        Alert.alert('Başarılı', 'Profil fotoğrafın güncellendi!');
      } catch (err) {
        Alert.alert('Hata', 'Fotoğraf güncellenemedi.');
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap', style: 'destructive', onPress: () => {
          global.authToken = null;
          global.userId = null;
          navigation.replace('Login');
        }
      }
    ]);
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <Animated.ScrollView style={[styles.container, { opacity: fadeAnim }]}>

      {/* HERO */}
      <LinearGradient colors={colors.headerGradient} style={styles.hero}>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsButton} activeOpacity={0.8}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handlePickPhoto} style={styles.avatarWrapper} disabled={uploadingPhoto}>
          {profile?.profileImageUrl ? (
            <Image source={{ uri: profile.profileImageUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.avatarEditText}>📷</Text>
            }
          </View>
        </TouchableOpacity>

        <Text style={styles.username}>@{profile?.username || 'Kullanıcı'}</Text>

        <View style={styles.bioContainer}>
          <Text style={styles.bioText}>
            {profile?.bio || "Kendinden bahsetmek için Ayarlar'a git"}
          </Text>
        </View>

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
      </LinearGradient>

      {/* SEKMELER */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            Postlarım ({posts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            Etkinliklerim ({events.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* İÇERİK */}
      <View style={styles.content}>
        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>Henüz post atmadın</Text>
              <Text style={styles.emptySubText}>Bir konsere git, deneyimini paylaş!</Text>
            </View>
          ) : (
            posts.map((item) => (
              <View key={item.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Text style={styles.postEventName}>{item.eventName || 'Etkinlik'}</Text>
                  <Text style={styles.postDate}>
                    {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
                <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
                <View style={styles.postFooter}>
                  <Text style={styles.postStat}>♥ {item.likeCount || 0}</Text>
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
              <Text style={styles.emptySubText}>Post attığın etkinlikler burada görünür</Text>
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
                      <Text style={styles.eventArtist} numberOfLines={1}>{item.artistName}</Text>
                    )}
                    <Text style={styles.eventDate}>
                      {new Date(item.eventDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}
      </View>

      {/* ÇIKIŞ */}
      <View style={styles.logoutArea}>
        <TouchableOpacity onPress={handleLogout}>
          <LinearGradient
            colors={['#E94560', '#7C3AED']}
            style={styles.logoutButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.logoutText}>Çıkış Yap</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

    </Animated.ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },

    // HERO
    hero: {
      paddingTop: 68,
      paddingBottom: 36,
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    topActions: {
      position: 'absolute',
      top: 56,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingsButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsIcon: {
      fontSize: 20,
    },

    // AVATAR
    avatarWrapper: {
      marginBottom: 18,
    },
    avatarImage: {
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 3,
      borderColor: colors.primary,
    },
    avatarPlaceholder: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.border,
    },
    avatarEmoji: { fontSize: 48 },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
    avatarEditText: { fontSize: 15 },

    // USERNAME & BIO
    username: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    bioContainer: {
      paddingHorizontal: 32,
      marginBottom: 28,
    },
    bioText: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },

    // STATS
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
      width: '100%',
    },
    stat: { alignItems: 'center' },
    statNumber: { fontSize: 24, fontWeight: '900', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700' },
    statDivider: { width: 1, height: 28, backgroundColor: colors.border },

    // TABS
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    tabTextActive: {
      color: colors.text,
      fontWeight: '700',
    },

    // CONTENT
    content: { padding: 16, paddingBottom: 8 },

    // POST CARD
    postCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    postEventName: { fontSize: 13, color: colors.primary, fontWeight: '700', flex: 1 },
    postDate: { fontSize: 11, color: colors.textSecondary },
    postContent: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 12 },
    postFooter: { flexDirection: 'row', gap: 14 },
    postStat: { fontSize: 13, color: colors.textSecondary },

    // EVENT GRID
    eventGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    eventCard: {
      width: CARD_WIDTH,
      borderRadius: 16,
      overflow: 'hidden',
    },
    eventCardGradient: {
      padding: 14,
      minHeight: 140,
      justifyContent: 'flex-end',
    },
    eventEmoji: { fontSize: 28, marginBottom: 8 },
    eventName: { fontSize: 13, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    eventArtist: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
    eventDate: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

    // EMPTY
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyEmoji: { fontSize: 52, marginBottom: 14 },
    emptyText: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
    emptySubText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },

    // LOGOUT
    logoutArea: { padding: 16, paddingBottom: 32 },
    logoutButton: { padding: 16, borderRadius: 16, alignItems: 'center' },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  });
}
