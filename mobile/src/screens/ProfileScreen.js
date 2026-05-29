import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform,
  Alert, Image, Animated, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const genreColors = ['#E94560', '#7C3AED', '#F5A623', '#00D4AA', '#3B82F6', '#EC4899', '#10B981', '#F97316'];

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [])
  );

  const fetchAll = async () => {
    if (!global.userId) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, postsRes, eventsRes, artistsRes, bookmarksRes, badgesRes] = await Promise.all([
        API.get(`/users/${global.userId}/profile`),
        API.get(`/users/${global.userId}/posts`),
        API.get(`/users/${global.userId}/events`),
        API.get(`/users/${global.userId}/followed-artists`),
        API.get(`/users/${global.userId}/bookmarks`),
        API.get(`/users/${global.userId}/badges/all`),
      ]);
      setProfile(profileRes.data);
      setPosts(postsRes.data);
      setEvents(eventsRes.data);
      setFollowedArtists(artistsRes.data);
      setBookmarks(bookmarksRes.data);
      setBadges(badgesRes.data);

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
        text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
          await AsyncStorage.multiRemove([
            'authToken', 'userId', 'username', 'userCity',
            'favoriteGenres', 'isAdmin', 'onboardingCompleted',
          ]);
          global.authToken = null;
          global.userId = null;
          global.username = null;
          global.userCity = null;
          global.favoriteGenres = null;
          global.isAdmin = false;
          global.onboardingCompleted = false;
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

  const handleEditSave = async () => {
    if (!editText.trim() || !editingPost) return;
    setEditSaving(true);
    try {
      const res = await API.patch(`/posts/${editingPost.id}`, { content: editText.trim() });
      setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: res.data.content } : p));
      setEditingPost(null);
    } catch {
      Alert.alert('Hata', 'Post düzenlenemedi.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <>
    <Modal visible={!!editingPost} transparent animationType="fade" onRequestClose={() => setEditingPost(null)}>
      <TouchableOpacity style={styles.editOverlay} activeOpacity={1} onPress={() => setEditingPost(null)} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editSheetWrapper}>
        <View style={[styles.editSheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.editTitle, { color: colors.text }]}>Postu Düzenle</Text>
          <TextInput
            style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.border }]} onPress={() => setEditingPost(null)}>
              <Text style={[styles.editBtnText, { color: colors.text }]}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.primary, opacity: editSaving ? 0.6 : 1 }]}
              onPress={handleEditSave}
              disabled={editSaving}
            >
              <Text style={[styles.editBtnText, { color: '#fff' }]}>{editSaving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Animated.ScrollView style={[styles.container, { opacity: fadeAnim }]}>

      {/* HERO — kompakt */}
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

        {!!profile?.bio && (
          <Text style={styles.bioText} numberOfLines={2}>
            {profile.bio}
          </Text>
        )}
      </LinearGradient>

      {/* STATS CARD */}
      <View style={styles.statsCard}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{posts.length}</Text>
          <Text style={styles.statLabel}>Post</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('FollowList', { userId: global.userId, type: 'followers' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{profile?.followerCount || 0}</Text>
          <Text style={styles.statLabel}>Takipçi</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('FollowList', { userId: global.userId, type: 'following' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{profile?.followingCount || 0}</Text>
          <Text style={styles.statLabel}>Takip</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{events.length}</Text>
          <Text style={styles.statLabel}>Etkinlik</Text>
        </View>
      </View>

      {/* SEKMELER */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            Postlar ({posts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            Etkinlikler ({events.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookmarks' && styles.tabActive]}
          onPress={() => setActiveTab('bookmarks')}
        >
          <Text style={[styles.tabText, activeTab === 'bookmarks' && styles.tabTextActive]}>
            🔖 ({bookmarks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'badges' && styles.tabActive]}
          onPress={() => setActiveTab('badges')}
        >
          <Text style={[styles.tabText, activeTab === 'badges' && styles.tabTextActive]}>
            🏅 ({badges.filter(b => b.earned).length}/{badges.length})
          </Text>
        </TouchableOpacity>

      </View>

      {/* İÇERİK */}
      <View style={styles.content}>
        {activeTab === 'music' ? (
          <View>
            {/* TÜRLER */}
            {profile?.favoriteGenres ? (
              <View style={styles.musicSection}>
                <Text style={styles.musicSectionTitle}>Favori Türler</Text>
                <View style={styles.genreRow}>
                  {profile.favoriteGenres.split(',').map((g, i) => (
                    <View key={i} style={[styles.genreChip, { backgroundColor: genreColors[i % genreColors.length] }]}>
                      <Text style={styles.genreChipText}>{g.trim()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* SANATÇILAR */}
            <View style={styles.musicSection}>
              <Text style={styles.musicSectionTitle}>Takip Edilen Sanatçılar</Text>
              {followedArtists.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🎤</Text>
                  <Text style={styles.emptyText}>Henüz sanatçı takip edilmiyor</Text>
                </View>
              ) : (
                <View style={styles.artistGrid}>
                  {followedArtists.map(artist => (
                    <TouchableOpacity
                      key={artist.id}
                      style={styles.artistCard}
                      onPress={() => navigation.navigate('ArtistProfile', { artistId: artist.id, artistName: artist.name })}
                      activeOpacity={0.8}
                    >
                      {artist.imageUrl ? (
                        <Image source={{ uri: artist.imageUrl }} style={styles.artistImage} />
                      ) : (
                        <View style={styles.artistImagePlaceholder}>
                          <Text style={styles.artistImageEmoji}>🎤</Text>
                        </View>
                      )}
                      <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : activeTab === 'posts' ? (
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.postDate}>
                      {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                    </Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => Alert.alert('Post İşlemleri', null, [
                        {
                          text: 'Düzenle', onPress: () => {
                            setEditText(item.content || '');
                            setEditingPost(item);
                          }
                        },
                        {
                          text: 'Sil', style: 'destructive', onPress: () =>
                            Alert.alert('Postu Sil', 'Emin misin?', [
                              { text: 'İptal', style: 'cancel' },
                              {
                                text: 'Sil', style: 'destructive', onPress: async () => {
                                  try {
                                    await API.delete(`/posts/${item.id}`);
                                    setPosts(prev => prev.filter(p => p.id !== item.id));
                                  } catch { Alert.alert('Hata', 'Post silinemedi.'); }
                                }
                              }
                            ])
                        },
                        { text: 'İptal', style: 'cancel' },
                      ])}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 18 }}>⋯</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
                <View style={styles.postFooter}>
                  <Text style={styles.postStat}>♥ {item.likeCount || 0}</Text>
                  <Text style={styles.postStat}>💬 {item.commentCount || 0}</Text>
                </View>
              </View>
            ))
          )
        ) : activeTab === 'events' ? (
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
        ) : activeTab === 'bookmarks' ? (
          bookmarks.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔖</Text>
              <Text style={styles.emptyText}>Henüz kaydedilen etkinlik yok</Text>
              <Text style={styles.emptySubText}>Etkinlik detayında 🏷️ butonuna bas</Text>
            </View>
          ) : (
            <View style={styles.eventGrid}>
              {bookmarks.map((item, index) => (
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
                    <Text style={styles.eventEmoji}>🔖</Text>
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
        ) : (
          <View style={styles.badgeGrid}>
            {badges.map(item => (
              <View key={item.id} style={[styles.badgeCard, !item.earned && styles.badgeCardLocked]}>
                <LinearGradient
                  colors={item.earned ? ['#7C3AED', '#E94560'] : ['#444', '#333']}
                  style={styles.badgeIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={[styles.badgeIcon, !item.earned && styles.badgeIconLocked]}>
                    {item.earned ? item.icon : '🔒'}
                  </Text>
                </LinearGradient>
                <Text style={[styles.badgeName, !item.earned && styles.badgeTextLocked]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.badgeDesc, !item.earned && styles.badgeTextLocked]} numberOfLines={2}>
                  {item.description}
                </Text>
                {item.earned ? (
                  <Text style={styles.badgeDate}>
                    {new Date(item.earnedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                  </Text>
                ) : item.required > 0 && (
                  <View style={styles.badgeProgressWrap}>
                    <View style={styles.badgeProgressBg}>
                      <View style={[styles.badgeProgressFill, { width: `${Math.round((item.progress / item.required) * 100)}%` }]} />
                    </View>
                    <Text style={styles.badgeProgressText}>{item.progress}/{item.required}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
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
    </>
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
      paddingTop: 52,
      paddingBottom: 20,
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    topActions: {
      position: 'absolute',
      top: 44,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingsButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsIcon: {
      fontSize: 17,
    },

    // AVATAR
    avatarWrapper: {
      marginBottom: 10,
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2.5,
      borderColor: colors.primary,
    },
    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2.5,
      borderColor: colors.border,
    },
    avatarEmoji: { fontSize: 34 },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    avatarEditText: { fontSize: 12 },

    // USERNAME & BIO
    username: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
    },
    bioText: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 24,
      marginTop: 4,
    },

    // STATS CARD
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stat: { flex: 1, alignItems: 'center' },
    statNumber: { fontSize: 18, fontWeight: '800', color: colors.text },
    statLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
    statDivider: { width: 1, height: 22, backgroundColor: colors.border },

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

    // MUSIC TAB
    musicSection: { marginBottom: 24 },
    musicSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
    genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    genreChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
    genreChipText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    artistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    artistCard: { width: (width - 64) / 3, alignItems: 'center' },
    artistImage: { width: (width - 64) / 3, height: (width - 64) / 3, borderRadius: 12, marginBottom: 6 },
    artistImagePlaceholder: {
      width: (width - 64) / 3, height: (width - 64) / 3, borderRadius: 12,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    },
    artistImageEmoji: { fontSize: 32 },
    artistName: { fontSize: 12, color: colors.text, fontWeight: '600', textAlign: 'center' },

    // BADGE GRID
    badgeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    badgeCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeIconBg: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    badgeCardLocked: { opacity: 0.55 },
    badgeIcon: { fontSize: 26 },
    badgeIconLocked: { opacity: 0.7 },
    badgeName: { fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4 },
    badgeTextLocked: { color: colors.textSecondary },
    badgeDesc: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 15, marginBottom: 6 },
    badgeDate: { fontSize: 10, color: colors.primary, fontWeight: '700' },
    badgeProgressWrap: { width: '100%', alignItems: 'center', gap: 3 },
    badgeProgressBg: { width: '100%', height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    badgeProgressFill: { height: 4, backgroundColor: '#7C3AED', borderRadius: 2 },
    badgeProgressText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },

    // LOGOUT
    logoutArea: { padding: 16, paddingBottom: 32 },
    logoutButton: { padding: 16, borderRadius: 16, alignItems: 'center' },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    editSheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    editSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
    editTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
    editInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 14 },
    editActions: { flexDirection: 'row', gap: 10 },
    editBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    editBtnText: { fontSize: 15, fontWeight: '700' },
  });
}
