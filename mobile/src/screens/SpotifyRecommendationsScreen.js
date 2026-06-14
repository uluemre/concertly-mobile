import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, ActivityIndicator, Alert, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

export default function SpotifyRecommendationsScreen({ navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [bulkFollowing, setBulkFollowing] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const res = await API.get(`/spotify/recommendations/${session.userId}`);
      setArtists(res.data);
      const followed = new Set(
        res.data.filter(a => a.followed && a.appArtistId).map(a => a.appArtistId)
      );
      setFollowingIds(followed);
    } catch (err) {
      Alert.alert(t('error'), t('spotify_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (artist) => {
    if (!artist.appArtistId) return;
    const isFollowed = followingIds.has(artist.appArtistId);
    try {
      if (isFollowed) {
        await API.delete(`/artists/${artist.appArtistId}/follow`);
        setFollowingIds(prev => { const s = new Set(prev); s.delete(artist.appArtistId); return s; });
      } else {
        await API.post(`/artists/${artist.appArtistId}/follow`);
        setFollowingIds(prev => new Set([...prev, artist.appArtistId]));
      }
    } catch {}
  };

  const handleBulkFollow = async () => {
    const unfollowed = artists.filter(a => a.appArtistId && !followingIds.has(a.appArtistId));
    if (unfollowed.length === 0) {
      Alert.alert(t('spotify_already_following'));
      return;
    }
    setBulkFollowing(true);
    try {
      const ids = unfollowed.map(a => a.appArtistId);
      await API.post('/artists/bulk-follow', { artistIds: ids });
      setFollowingIds(prev => new Set([...prev, ...ids]));
    } catch {
      Alert.alert(t('error'), t('spotify_bulk_error'));
    } finally {
      setBulkFollowing(false);
    }
  };

  const appMatchCount = artists.filter(a => a.appArtistId).length;

  const renderArtist = ({ item, index }) => {
    const isFollowed = followingIds.has(item.appArtistId);
    const inApp = !!item.appArtistId;

    return (
      <View style={styles.artistRow}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.artistImg} />
        ) : (
          <View style={[styles.artistImg, styles.artistImgPlaceholder]}>
            <Text style={{ fontSize: 22 }}>🎤</Text>
          </View>
        )}
        <View style={styles.artistInfo}>
          <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.artistMeta}>
            {item.genre ? (
              <View style={styles.genreTag}>
                <Text style={styles.genreTagText}>{item.genre}</Text>
              </View>
            ) : null}
            {!inApp && (
              <Text style={styles.notInApp}>{t('spotify_not_in_app')}</Text>
            )}
          </View>
        </View>
        {inApp ? (
          <TouchableOpacity
            style={[styles.followBtn, isFollowed && styles.followBtnActive]}
            onPress={() => handleFollow(item)}
            activeOpacity={0.8}
          >
            <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
              {isFollowed ? t('artist_following') : t('artist_follow')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.followBtnDisabled}>
            <Text style={styles.followBtnTextDisabled}>—</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('spotify_title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Spotify'dan getiriliyor...
          </Text>
        </View>
      ) : artists.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 52 }}>🎧</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('spotify_no_data')}</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{t('spotify_no_data_sub')}</Text>
        </View>
      ) : (
        <FlatList
          data={artists}
          keyExtractor={item => item.spotifyId}
          renderItem={renderArtist}
          ListHeaderComponent={() => (
            <View style={styles.listHeader}>
              <LinearGradient colors={['#1DB954', '#191414']} style={styles.heroBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={styles.heroIcon}>🎵</Text>
                <Text style={styles.heroTitle}>{t('spotify_hero_title')}</Text>
                <Text style={styles.heroSubtitle}>
                  {appMatchCount} {t('spotify_in_app')}
                </Text>
              </LinearGradient>
              {appMatchCount > 0 && (
                <TouchableOpacity
                  style={styles.bulkBtn}
                  onPress={handleBulkFollow}
                  disabled={bulkFollowing}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#1DB954', '#158a3e']}
                    style={styles.bulkBtnGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    {bulkFollowing
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.bulkBtnText}>{t('spotify_follow_all', { count: appMatchCount })}</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 60 },
    backBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
    loadingText: { marginTop: 12, fontSize: 14 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
    emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    listContent: { paddingBottom: 40 },
    listHeader: { padding: 16, gap: 12 },
    heroBanner: {
      borderRadius: 16, padding: 20, alignItems: 'center', gap: 6,
    },
    heroIcon: { fontSize: 40 },
    heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    bulkBtn: { borderRadius: 14, overflow: 'hidden' },
    bulkBtnGradient: { padding: 16, alignItems: 'center' },
    bulkBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    artistRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
    },
    rankBadge: { width: 28, alignItems: 'center' },
    rankText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    artistImg: { width: 50, height: 50, borderRadius: 25 },
    artistImgPlaceholder: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    artistInfo: { flex: 1 },
    artistName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    artistMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    genreTag: {
      backgroundColor: 'rgba(29,185,84,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    },
    genreTagText: { fontSize: 11, color: '#1DB954', fontWeight: '600' },
    notInApp: { fontSize: 11, color: colors.textSecondary },
    followBtn: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1.5, borderColor: '#1DB954',
    },
    followBtnActive: { backgroundColor: '#1DB954', borderColor: '#1DB954' },
    followBtnText: { fontSize: 12, fontWeight: '700', color: '#1DB954' },
    followBtnTextActive: { color: '#fff' },
    followBtnDisabled: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1.5, borderColor: colors.border,
    },
    followBtnTextDisabled: { fontSize: 12, color: colors.border },
  });
}
