import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform,
  Alert, Image, Animated, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import API from '../services/api';
import { useTheme } from '../theme';
import BadgeGrid from '../components/profile/BadgeGrid';

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
  const { session, logout } = useAuth();
  const { t } = useLanguage();
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
    if (!session.userId) {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      return;
    }
    try {
      const [profileRes, postsRes, eventsRes, artistsRes, bookmarksRes, badgesRes] = await Promise.all([
        API.get(`/users/${session.userId}/profile`),
        API.get(`/users/${session.userId}/posts`),
        API.get(`/users/${session.userId}/events`),
        API.get(`/users/${session.userId}/followed-artists`),
        API.get(`/users/${session.userId}/bookmarks`),
        API.get(`/users/${session.userId}/badges/all`),
      ]);
      setProfile(profileRes.data);
      setPosts(postsRes.data);
      setEvents(eventsRes.data);
      setFollowedArtists(artistsRes.data);
      setBookmarks(bookmarksRes.data);
      setBadges(badgesRes.data);
    } catch (err) {
      console.log('Profil hatası:', err.message);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile_photo_perm_title'), t('profile_photo_perm_msg'));
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
        await API.put(`/users/${session.userId}/profile`, {
          profileImageUrl: localUri,
        });
        setProfile(prev => ({ ...prev, profileImageUrl: localUri }));
        Alert.alert(t('success'), t('profile_photo_updated'));
      } catch (err) {
        Alert.alert(t('error'), t('profile_photo_error'));
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile_logout'), t('profile_logout_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('profile_logout'), style: 'destructive', onPress: async () => {
          await logout();
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
      Alert.alert(t('error'), t('profile_edit_error'));
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
          <Text style={[styles.editTitle, { color: colors.text }]}>{t('profile_edit_title')}</Text>
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
              <Text style={[styles.editBtnText, { color: colors.text }]}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.primary, opacity: editSaving ? 0.6 : 1 }]}
              onPress={handleEditSave}
              disabled={editSaving}
            >
              <Text style={[styles.editBtnText, { color: '#fff' }]}>{editSaving ? t('profile_edit_saving') : t('profile_edit_save')}</Text>
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
          <Text style={styles.statLabel}>{t('profile_stat_posts')}</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('FollowList', { userId: session.userId, type: 'followers' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{profile?.followerCount || 0}</Text>
          <Text style={styles.statLabel}>{t('profile_followers')}</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.stat}
          onPress={() => navigation.navigate('FollowList', { userId: session.userId, type: 'following' })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{profile?.followingCount || 0}</Text>
          <Text style={styles.statLabel}>{t('profile_following')}</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{events.length}</Text>
          <Text style={styles.statLabel}>{t('profile_stat_events')}</Text>
        </View>
      </View>

      {/* SEKMELER */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            {t('profile_posts')} ({posts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            {t('profile_events')} ({events.length})
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
        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>{t('profile_empty_posts')}</Text>
              <Text style={styles.emptySubText}>{t('profile_empty_posts_sub')}</Text>
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
                      onPress={() => Alert.alert(t('profile_post_actions'), null, [
                        {
                          text: t('profile_post_edit_action'), onPress: () => {
                            setEditText(item.content || '');
                            setEditingPost(item);
                          }
                        },
                        {
                          text: t('profile_post_delete_action'), style: 'destructive', onPress: () =>
                            Alert.alert(t('profile_post_delete_title'), t('profile_post_delete_confirm'), [
                              { text: t('cancel'), style: 'cancel' },
                              {
                                text: t('delete'), style: 'destructive', onPress: async () => {
                                  try {
                                    await API.delete(`/posts/${item.id}`);
                                    setPosts(prev => prev.filter(p => p.id !== item.id));
                                  } catch { Alert.alert(t('error'), t('profile_post_delete_error')); }
                                }
                              }
                            ])
                        },
                        { text: t('cancel'), style: 'cancel' },
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
              <Text style={styles.emptyText}>{t('profile_empty_events')}</Text>
              <Text style={styles.emptySubText}>{t('profile_empty_events_sub')}</Text>
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
              <Text style={styles.emptyText}>{t('profile_empty_bookmarks')}</Text>
              <Text style={styles.emptySubText}>{t('profile_empty_bookmarks_sub')}</Text>
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
          <BadgeGrid badges={badges} />
        )}
      </View>

      {/* KONSER PASAPORTU */}
      <View style={styles.passportArea}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ConcertPassport')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#1A0A2E', '#0A1628']}
            style={styles.passportButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.passportEmoji}>🎟️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.passportTitle}>Konser Pasaportu</Text>
              <Text style={styles.passportSub}>Gittiğin konserlerin tarihi</Text>
            </View>
            <Text style={styles.passportChevron}>›</Text>
          </LinearGradient>
        </TouchableOpacity>
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
            <Text style={styles.logoutText}>{t('profile_logout_btn')}</Text>
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

    // PASSPORT
    passportArea: { paddingHorizontal: 16, paddingBottom: 8 },
    passportButton: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 16, borderRadius: 16,
      borderWidth: 1, borderColor: '#2A1A4E',
    },
    passportEmoji: { fontSize: 28 },
    passportTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 2 },
    passportSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    passportChevron: { color: 'rgba(255,255,255,0.4)', fontSize: 24 },

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
