import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import API from '../services/api';
import ArtistCard from '../components/ArtistCard';

export default function ArtistSelectionScreen({ route, navigation }) {
  const { selectedGenres, editMode = false } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [artists, setArtists] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const genresParam = selectedGenres.join(',');
        const res = await API.get(`/artists/recommended?genres=${encodeURIComponent(genresParam)}`);
        setArtists(res.data);
      } catch (err) {
        console.error('Artist fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleArtist = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredArtists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? artists.filter(a => a.name.toLowerCase().includes(q)) : artists;
  }, [artists, search]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await API.post('/auth/onboarding', {
        genres: selectedGenres,
        artistIds: selectedIds,
      });
      global.onboardingCompleted = true;
      global.favoriteGenres = selectedGenres.join(',');
      await AsyncStorage.multiSet([
        ['onboardingCompleted', 'true'],
        ['favoriteGenres', selectedGenres.join(',')],
      ]);
      if (editMode) {
        navigation.navigate('MusicProfile');
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [{ name: 'MainApp' }, { name: 'MusicProfile' }],
          })
        );
      }
    } catch (err) {
      console.error('Onboarding complete error:', err);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        {editMode ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
          </View>
        )}

        <Text style={styles.title}>Sevdiğin sanatçıları seç</Text>
        <Text style={styles.subtitle}>
          Seçtiğin türlere göre {artists.length} sanatçı bulduk. İstediğin kadar seç, hepsini takip edeceğiz.
        </Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Sanatçı ara..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyText}>Sanatçılar yükleniyor...</Text>
          </View>
        ) : filteredArtists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emoji}>🎵</Text>
            <Text style={styles.emptyTitle}>Sanatçı bulunamadı</Text>
            <Text style={styles.emptyText}>
              Bu türlerde henüz sanatçı eklenmemiş. Daha sonra Keşfet'ten takip edebilirsin.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredArtists}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.artistRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item, index }) => (
              <ArtistCard
                artist={item}
                selected={selectedIds.includes(item.id)}
                onToggle={toggleArtist}
                index={index}
              />
            )}
          />
        )}
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.countText}>
          {selectedIds.length === 0
            ? 'Seçim zorunlu değil'
            : `${selectedIds.length} sanatçı seçildi`}
        </Text>
        <TouchableOpacity
          disabled={completing}
          onPress={handleComplete}
          style={{ width: '100%' }}
        >
          <LinearGradient
            colors={['#E94560', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {completing ? 'Kaydediliyor...' : editMode ? 'Kaydet' : 'Tamamla'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
    backBtn: { marginBottom: 24 },
    backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
    stepIndicator: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    stepDot: { width: 32, height: 4, borderRadius: 2, backgroundColor: '#2A2A3E' },
    stepDotActive: { backgroundColor: '#E94560', width: 48 },
    title: { color: colors.text, fontSize: 28, fontWeight: 'bold', marginBottom: 8, lineHeight: 36 },
    subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
      marginBottom: 16,
    },
    searchIcon: { color: colors.textSecondary, fontSize: 17 },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    clearBtn: { color: colors.textSecondary, fontSize: 16, padding: 4 },
    artistRow: { gap: 10, justifyContent: 'space-between' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
    emoji: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
    emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
    bottomBar: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 12,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    countText: { color: colors.textSecondary, fontSize: 12, marginBottom: 10 },
    button: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  });
}
