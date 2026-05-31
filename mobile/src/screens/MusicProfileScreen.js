import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';

const { width } = Dimensions.get('window');
// 2 × padding(20) + 2 × gap(14) = 68
const ARTIST_SIZE = (width - 68) / 3;

const GENRE_PREVIEW = 3;
const ARTIST_PREVIEW = 3;

const genreColors = [
  '#E94560', '#7C3AED', '#F5A623', '#00D4AA',
  '#3B82F6', '#EC4899', '#10B981', '#F97316',
];

export default function MusicProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState(null);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showAllArtists, setShowAllArtists] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, artistsRes] = await Promise.all([
        API.get(`/users/${session.userId}/profile`),
        API.get(`/users/${session.userId}/followed-artists`),
      ]);
      setProfile(profileRes.data);
      setArtists(artistsRes.data);
    } catch (err) {
      console.log('Müzik profili hatası:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const genres = profile?.favoriteGenres
    ? profile.favoriteGenres.split(',').map(g => g.trim()).filter(Boolean)
    : [];

  const visibleGenres = showAllGenres ? genres : genres.slice(0, GENRE_PREVIEW);
  const hiddenGenreCount = genres.length - GENRE_PREVIEW;

  const visibleArtists = showAllArtists ? artists : artists.slice(0, ARTIST_PREVIEW);
  const hiddenArtistCount = artists.length - ARTIST_PREVIEW;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <LinearGradient colors={['#7C3AED', '#E94560']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerEmoji}>✨</Text>
        <Text style={styles.headerTitle}>Müzik Profilim</Text>
        <Text style={styles.headerSub}>Tür ve sanatçı tercihlerini yönet</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('GenreSelection', { editMode: true })}
          activeOpacity={0.85}
        >
          <Text style={styles.editBtnText}>✏️ Güncelle</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.content}>

        {/* FAVORİ TÜRLER */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Favori Türler</Text>
            {genres.length > 0 && (
              <Text style={styles.sectionCount}>{genres.length}</Text>
            )}
          </View>

          {genres.length === 0 ? (
            <Text style={styles.emptySmallText}>Henüz tür seçilmemiş</Text>
          ) : (
            <View style={styles.genreRow}>
              {visibleGenres.map((g, i) => (
                <View
                  key={i}
                  style={[styles.genreChip, { backgroundColor: genreColors[i % genreColors.length] }]}
                >
                  <Text style={styles.genreChipText}>{g}</Text>
                </View>
              ))}

              {!showAllGenres && hiddenGenreCount > 0 && (
                <TouchableOpacity
                  style={styles.genreChipMore}
                  onPress={() => setShowAllGenres(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.genreChipMoreText}>+{hiddenGenreCount}</Text>
                </TouchableOpacity>
              )}

              {showAllGenres && genres.length > GENRE_PREVIEW && (
                <TouchableOpacity
                  style={styles.genreChipMore}
                  onPress={() => setShowAllGenres(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.genreChipMoreText}>Gizle</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* TAKİP EDİLEN SANATÇILAR */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Takip Edilen Sanatçılar</Text>
            {artists.length > 0 && (
              <Text style={styles.sectionCount}>{artists.length}</Text>
            )}
          </View>

          {artists.length === 0 ? (
            <View style={styles.emptyLarge}>
              <Text style={styles.emptyEmoji}>🎤</Text>
              <Text style={styles.emptyTitle}>Henüz sanatçı takip edilmiyor</Text>
              <Text style={styles.emptySub}>Güncelle butonuna basarak sanatçı takip edebilirsin</Text>
            </View>
          ) : (
            <View style={styles.artistGrid}>
              {visibleArtists.map(artist => (
                <TouchableOpacity
                  key={artist.id}
                  style={styles.artistCard}
                  onPress={() => navigation.navigate('ArtistProfile', {
                    artistId: artist.id,
                    artistName: artist.name,
                  })}
                  activeOpacity={0.8}
                >
                  {artist.imageUrl ? (
                    <Image source={{ uri: artist.imageUrl }} style={styles.artistImage} />
                  ) : (
                    <LinearGradient
                      colors={['#7C3AED', '#E94560']}
                      style={styles.artistImagePlaceholder}
                    >
                      <Text style={styles.artistInitial}>
                        {artist.name?.charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                  <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
                  <Text style={styles.artistFollowers}>
                    {artist.followerCount > 0 ? `${artist.followerCount} takipçi` : ''}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* +N card */}
              {!showAllArtists && hiddenArtistCount > 0 && (
                <TouchableOpacity
                  style={styles.artistCard}
                  onPress={() => setShowAllArtists(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.artistMoreBox}>
                    <Text style={styles.artistMorePlus}>+{hiddenArtistCount}</Text>
                    <Text style={styles.artistMoreLabel}>daha</Text>
                  </View>
                  <Text style={styles.artistName}> </Text>
                </TouchableOpacity>
              )}

              {/* Gizle card */}
              {showAllArtists && artists.length > ARTIST_PREVIEW && (
                <TouchableOpacity
                  style={styles.artistCard}
                  onPress={() => setShowAllArtists(false)}
                  activeOpacity={0.8}
                >
                  <View style={styles.artistMoreBox}>
                    <Text style={styles.artistMorePlus}>↑</Text>
                    <Text style={styles.artistMoreLabel}>Gizle</Text>
                  </View>
                  <Text style={styles.artistName}> </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

    header: {
      paddingTop: 60,
      paddingBottom: 32,
      paddingHorizontal: 24,
    },
    backBtn: { marginBottom: 20 },
    backText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
    headerEmoji: { fontSize: 40, marginBottom: 10 },
    headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 6 },
    headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 16 },
    editBtn: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    },
    editBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    content: { padding: 20 },

    section: { marginBottom: 32 },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center',
      gap: 8, marginBottom: 14,
    },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
    sectionCount: {
      fontSize: 12, fontWeight: '700', color: colors.primary,
      backgroundColor: colors.card, paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    },

    // GENRES
    genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    genreChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24 },
    genreChipText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    genreChipMore: {
      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1.5, borderColor: colors.primary,
    },
    genreChipMoreText: { color: colors.primary, fontSize: 14, fontWeight: '700' },

    // ARTISTS
    artistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    artistCard: { width: ARTIST_SIZE, alignItems: 'center' },
    artistImage: {
      width: ARTIST_SIZE, height: ARTIST_SIZE,
      borderRadius: 14, marginBottom: 7,
    },
    artistImagePlaceholder: {
      width: ARTIST_SIZE, height: ARTIST_SIZE,
      borderRadius: 14, marginBottom: 7,
      justifyContent: 'center', alignItems: 'center',
    },
    artistInitial: { fontSize: 34, fontWeight: '900', color: '#fff' },
    artistMoreBox: {
      width: ARTIST_SIZE, height: ARTIST_SIZE,
      borderRadius: 14, marginBottom: 7,
      backgroundColor: colors.card,
      borderWidth: 1.5, borderColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    artistMorePlus: { fontSize: 24, fontWeight: '900', color: colors.primary },
    artistMoreLabel: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
    artistName: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
    artistFollowers: { fontSize: 11, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },

    emptySmallText: { color: colors.textSecondary, fontSize: 14, paddingVertical: 8 },
    emptyLarge: { alignItems: 'center', paddingVertical: 40 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
    emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  });
}
