import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl, FlatList,
  Dimensions, TextInput, ScrollView, Modal,
} from 'react-native';
import { Image } from 'expo-image';
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

const CITIES = ['Tümü', 'Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Mersin', 'Eskisehir'];
const GENRES = ['Tümü', 'Rock', 'Pop', 'Rap', 'Elektronik', 'Jazz', 'Klasik', 'Indie', 'R&B', 'Folk'];
const SORT_OPTIONS = [
  { key: 'date_asc', label: 'Yakın Tarih' },
  { key: 'date_desc', label: 'Uzak Tarih' },
  { key: 'name_asc', label: 'A → Z' },
];

export default function EventsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState(global.userCity || null);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [sortKey, setSortKey] = useState('date_asc');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchEvents = (city) => {
    const activeCity = city !== undefined ? city : selectedCity;
    const url = activeCity ? `/events?city=${encodeURIComponent(activeCity)}` : '/events';
    return API.get(url)
      .then(res => setEvents(res.data))
      .catch(err => console.error('Events fetch error:', err.message));
  };

  useEffect(() => {
    fetchEvents().finally(() => setLoading(false));
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents().finally(() => setRefreshing(false));
  };

  const handleCitySelect = (city) => {
    const val = city === 'Tümü' ? null : city;
    setSelectedCity(val);
    setCityModalVisible(false);
    setLoading(true);
    fetchEvents(val).finally(() => setLoading(false));
  };

  const filtered = useMemo(() => {
    let list = [...events];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.artistName?.toLowerCase().includes(q) ||
        e.venueCity?.toLowerCase().includes(q)
      );
    }

    if (selectedGenre) {
      list = list.filter(e => e.genre?.toLowerCase().includes(selectedGenre.toLowerCase()));
    }

    if (startDate.trim()) {
      const [d, m, y] = startDate.split('.');
      const start = new Date(`${y}-${m}-${d}`);
      if (!isNaN(start)) list = list.filter(e => new Date(e.eventDate) >= start);
    }

    if (endDate.trim()) {
      const [d, m, y] = endDate.split('.');
      const end = new Date(`${y}-${m}-${d}`);
      end.setHours(23, 59, 59);
      if (!isNaN(end)) list = list.filter(e => new Date(e.eventDate) <= end);
    }

    if (sortKey === 'date_asc') list.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    else if (sortKey === 'date_desc') list.sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
    else if (sortKey === 'name_asc') list.sort((a, b) => a.name?.localeCompare(b.name));

    return list;
  }, [events, search, selectedGenre, sortKey, startDate, endDate]);

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>🎟️ Etkinlikler</Text>
            <Text style={styles.headerSub}>{filtered.length} etkinlik bulundu</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity onPress={() => setCityModalVisible(true)} style={[styles.headerBtn, { borderColor: colors.primary + '60' }]} activeOpacity={0.8}>
              <Text style={styles.headerBtnIcon}>📍</Text>
              <Text style={[styles.headerBtnText, { color: colors.primary }]} numberOfLines={1}>{selectedCity || 'Tümü'}</Text>
              <Text style={[styles.headerBtnChevron, { color: colors.primary }]}>▾</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              style={[styles.headerBtn, { borderColor: (selectedGenre || sortKey !== 'date_asc') ? colors.primary : colors.border }]}
              activeOpacity={0.8}
            >
              <Text style={styles.headerBtnIcon}>⚙️</Text>
              <Text style={[styles.headerBtnText, { color: (selectedGenre || sortKey !== 'date_asc') ? colors.primary : colors.textSecondary }]}>Filtrele</Text>
              {(selectedGenre || sortKey !== 'date_asc') && <View style={[styles.filterDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>⌕</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Etkinlik, sanatçı ara..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: colors.textSecondary, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.cardWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('EventDetail', { event: item })}
            activeOpacity={0.85}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} contentFit="cover" />
            ) : (
              <LinearGradient colors={gradientSets[index % gradientSets.length]} style={styles.cardImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={styles.cardEmoji}>{eventEmojis[index % eventEmojis.length]}</Text>
              </LinearGradient>
            )}
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>
                {new Date(item.eventDate).getDate()} {new Date(item.eventDate).toLocaleDateString('tr-TR', { month: 'short' })}
              </Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
              {item.artistName && <Text style={[styles.cardArtist, { color: colors.textSecondary }]} numberOfLines={1}>🎤 {item.artistName}</Text>}
              {item.venueCity && <Text style={[styles.cardCity, { color: colors.textSecondary }]} numberOfLines={1}>📍 {item.venueCity}</Text>}
              {item.genre && (
                <View style={[styles.genrePill, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[styles.genrePillText, { color: colors.primary }]}>{item.genre}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎭</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Etkinlik bulunamadı</Text>
          </View>
        }
      />

      {/* FİLTRE MODAL */}
      <Modal visible={filterModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
        <View style={[styles.cityModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={[styles.cityModalTitle, { color: colors.text, marginBottom: 0 }]}>Filtrele</Text>
            <TouchableOpacity onPress={() => { setSelectedGenre(null); setSortKey('date_asc'); setStartDate(''); setEndDate(''); }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Sıfırla</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.filterSectionLabel, { color: colors.textSecondary }]}>TÜR</Text>
          <View style={styles.filterChipsWrap}>
            {GENRES.map(genre => {
              const active = genre === 'Tümü' ? !selectedGenre : selectedGenre === genre;
              return (
                <TouchableOpacity
                  key={genre}
                  onPress={() => setSelectedGenre(genre === 'Tümü' ? null : genre)}
                  style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '22' : colors.background }]}
                >
                  <Text style={[styles.chipText, { color: active ? colors.primary : colors.textSecondary }]}>{genre}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.filterSectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>TARİH ARALIĞI</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateInputWrap}>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Başlangıç</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: colors.background, borderColor: startDate ? colors.primary : colors.border, color: colors.text }]}
                placeholder="GG.AA.YYYY"
                placeholderTextColor={colors.textSecondary}
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <Text style={[styles.dateSeparator, { color: colors.textSecondary }]}>—</Text>
            <View style={styles.dateInputWrap}>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Bitiş</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: colors.background, borderColor: endDate ? colors.primary : colors.border, color: colors.text }]}
                placeholder="GG.AA.YYYY"
                placeholderTextColor={colors.textSecondary}
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

          <Text style={[styles.filterSectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>SIRALAMA</Text>
          <View style={styles.filterChipsWrap}>
            {SORT_OPTIONS.map(opt => {
              const active = sortKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSortKey(opt.key)}
                  style={[styles.chip, { borderColor: active ? '#F5A623' : colors.border, backgroundColor: active ? '#F5A62322' : colors.background }]}
                >
                  <Text style={[styles.chipText, { color: active ? '#F5A623' : colors.textSecondary }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => setFilterModalVisible(false)}
            style={[styles.applyBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.applyBtnText}>Uygula</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ŞEHİR MODAL */}
      <Modal visible={cityModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCityModalVisible(false)} />
        <View style={[styles.cityModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cityModalTitle, { color: colors.text }]}>Şehir Seç</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {CITIES.map(city => {
              const active = city === 'Tümü' ? !selectedCity : selectedCity === city;
              return (
                <TouchableOpacity
                  key={city}
                  onPress={() => handleCitySelect(city)}
                  style={[styles.cityOption, active && { backgroundColor: colors.primary + '22' }]}
                >
                  <Text style={[styles.cityOptionText, { color: active ? colors.primary : colors.text }]}>
                    {city === 'Tümü' ? '🌍 Tüm Türkiye' : `📍 ${city}`}
                  </Text>
                  {active && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

    header: { paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
    headerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    headerBtns: { flexDirection: 'row', gap: 8 },
    headerBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 4, backgroundColor: colors.card },
    headerBtnIcon: { fontSize: 12 },
    headerBtnText: { fontSize: 12, fontWeight: '700', maxWidth: 60 },
    headerBtnChevron: { fontSize: 10 },
    filterDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 2 },

    searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
    searchIcon: { fontSize: 17 },
    searchInput: { flex: 1, fontSize: 14 },

    filterSectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
    filterChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
    chipText: { fontSize: 12, fontWeight: '600' },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dateInputWrap: { flex: 1 },
    dateLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
    dateInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
    dateSeparator: { fontSize: 18, marginTop: 16 },
    applyBtn: { marginTop: 24, padding: 14, borderRadius: 14, alignItems: 'center' },
    applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    list: { padding: 14, paddingTop: 16, paddingBottom: 32 },
    row: { justifyContent: 'space-between', marginBottom: 14 },
    cardWrapper: { width: CARD_WIDTH, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
    cardImage: { width: '100%', height: 120, justifyContent: 'center', alignItems: 'center' },
    cardEmoji: { fontSize: 40 },
    datePill: { position: 'absolute', top: 100, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    datePillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    cardBody: { padding: 10 },
    cardName: { fontSize: 13, fontWeight: 'bold', marginBottom: 3 },
    cardArtist: { fontSize: 11, marginBottom: 2 },
    cardCity: { fontSize: 11, marginBottom: 4 },
    genrePill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    genrePillText: { fontSize: 10, fontWeight: '700' },

    empty: { alignItems: 'center', marginTop: 80 },
    emptyEmoji: { fontSize: 56, marginBottom: 12 },
    emptyText: { fontSize: 15 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    cityModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 40, maxHeight: '60%' },
    cityModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    cityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10, marginBottom: 3 },
    cityOptionText: { fontSize: 15 },
  });
}
