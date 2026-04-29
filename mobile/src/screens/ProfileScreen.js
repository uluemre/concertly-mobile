import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, TextInput,
  Alert, Image, FlatList, Animated, Dimensions
} from 'react-native';
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
  const { colors, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile]     = useState(null);
  const [posts, setPosts]         = useState([]);
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'events'
  const [editing, setEditing]     = useState(false);
  const [bio, setBio]             = useState('');
  const [saving, setSaving]       = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    if (!global.userId) return;
    try {
      const [profileRes, postsRes, eventsRes] = await Promise.all([
        API.get(`/users/${global.userId}/profile`),
        API.get(`/users/${global.userId}/posts`),
        API.get(`/users/${global.userId}/events`),
      ]);
      setProfile(profileRes.data);
      setBio(profileRes.data.bio || '');
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

  // 📷 GALERİDEN FOTOĞRAF SEÇ
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
        // Şimdilik local URI'yi profileImageUrl olarak kaydediyoruz
        // Gerçek projede burada S3/Cloudinary'e upload edilir
        await API.put(`/users/${global.userId}/profile`, {
          profileImageUrl: localUri,
        });
        setProfile(prev => ({ ...prev, profileImageUrl: localUri }));
        Alert.alert('✅ Başarılı', 'Profil fotoğrafın güncellendi!');
      } catch (err) {
        Alert.alert('Hata', 'Fotoğraf güncellenemedi.');
        console.log(err.message);
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  // 💾 BİO KAYDET
  const handleSaveBio = async () => {
    setSaving(true);
    try {
      await API.put(`/users/${global.userId}/profile`, { bio });
      setProfile(prev => ({ ...prev, bio }));
      setEditing(false);
      Alert.alert('✅ Kaydedildi', 'Bion güncellendi!');
    } catch (err) {
      Alert.alert('Hata', 'Bio kaydedilemedi.');
    } finally {
      setSaving(false);
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

  const renderPost = ({ item, index }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Text style={styles.postEventName}>🎵 {item.eventName || 'Etkinlik'}</Text>
        <Text style={styles.postDate}>
          {new Date(item.createdAt).toLocaleDateString('tr-TR')}
        </Text>
      </View>
      <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
      <View style={styles.postFooter}>
        <Text style={styles.postStat}>❤️ {item.likeCount || 0}</Text>
        <Text style={styles.postStat}>💬 {item.commentCount || 0}</Text>
      </View>
    </View>
  );

  const renderEvent = ({ item, index }) => (
    <TouchableOpacity
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
          <Text style={styles.eventArtist} numberOfLines={1}>🎤 {item.artistName}</Text>
        )}
        <Text style={styles.eventDate}>
          📅 {new Date(item.eventDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <Animated.ScrollView style={[styles.container, { opacity: fadeAnim }]}>

      {/* HERO */}
      <LinearGradient colors={['#7C3AED', '#E94560']} style={styles.hero}>
        <View style={styles.themeToggle}>
          <TouchableOpacity
            onPress={() => setThemeMode('dark')}
            style={[styles.themeToggleOption, themeMode === 'dark' && styles.themeToggleOptionActive]}
            activeOpacity={0.85}
          >
            <Text style={styles.themeToggleIcon}>🌙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setThemeMode('light')}
            style={[styles.themeToggleOption, themeMode === 'light' && styles.themeToggleOptionActive]}
            activeOpacity={0.85}
          >
            <Text style={styles.themeToggleIcon}>☀️</Text>
          </TouchableOpacity>
        </View>

        {/* AVATAR */}
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

        {/* BIO */}
        {editing ? (
          <View style={styles.bioEditContainer}>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Kendini tanıt... 🎸"
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              maxLength={150}
            />
            <View style={styles.bioEditButtons}>
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.bioCancel}>
                <Text style={styles.bioCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveBio} style={styles.bioSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.bioSaveText}>Kaydet ✓</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.bioContainer}>
            <Text style={styles.bioText}>
              {profile?.bio ? profile.bio : '+ Bio ekle'}
            </Text>
            <Text style={styles.bioEditIcon}>✏️</Text>
          </TouchableOpacity>
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
      </LinearGradient>

      {/* SEKMELER */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            🎵 Postlarım ({posts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            🎪 Etkinliklerim ({events.length})
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
            posts.map((item, index) => (
              <View key={item.id}>
                {renderPost({ item, index })}
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
                <View key={item.id} style={styles.eventGridItem}>
                  {renderEvent({ item, index })}
                </View>
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
            <Text style={styles.logoutText}>🚪 Çıkış Yap</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

    </Animated.ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  // HERO
  hero: {
    paddingTop: 64,
    paddingBottom: 28,
    alignItems: 'center',
    paddingHorizontal: 24,
    position: 'relative',
  },
  themeToggle: {
    position: 'absolute',
    top: 52,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  themeToggleOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  themeToggleIcon: {
    fontSize: 14,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarEmoji: { fontSize: 44 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarEditText: { fontSize: 14 },

  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },

  // BIO
  bioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  bioText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bioEditIcon: { fontSize: 14 },
  bioEditContainer: {
    width: '100%',
    marginBottom: 20,
  },
  bioInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  bioEditButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  bioCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  bioCancelText: { color: '#fff', fontSize: 14 },
  bioSave: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  bioSaveText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // STATS
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 16,
  },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },

  // SEKMELER
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },

  // İÇERİK
  content: { padding: 16, paddingBottom: 8 },

  // POST KARTI
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

  // ETKİNLİK GRİD
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  eventGridItem: {
    width: CARD_WIDTH,
  },
  eventCard: {
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

  // BOŞ DURUM
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySubText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },

  // ÇIKIŞ
  logoutArea: { padding: 16, paddingBottom: 32 },
  logoutButton: { padding: 16, borderRadius: 16, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
