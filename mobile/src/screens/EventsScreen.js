import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, RefreshControl, FlatList,
  TextInput, ScrollView, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchAllConcerts } from '../services/concerts';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AnimatedListItem from '../components/AnimatedListItem';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventCard from '../components/EventCard';
import { findGenericImages } from '../utils/eventImage';
import { EventsSkeletonPage } from '../components/SkeletonLoader';
import { LAUNCH_CITIES, launchCityOrNull } from '../constants/cities';
import { parseEventDate } from '../utils/time';
import { foldSearch } from '../utils/text';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';

const CITIES = ['Tümü', ...LAUNCH_CITIES];

// Kullanıcının seçtiği liste görünümü; cihazda hatırlanır.
const LAYOUT_KEY = 'eventsLayout';
const LAYOUTS = [
  { key: 'poster', icon: 'square-outline', label: 'events_layout_large' },
  { key: 'row', icon: 'reorder-four-outline', label: 'events_layout_list' },
  { key: 'tile', icon: 'grid-outline', label: 'events_layout_grid' },
];
const GENRES = ['Tümü', 'Rock', 'Pop', 'Rap', 'Elektronik', 'Jazz', 'Klasik', 'Indie', 'R&B', 'Folk'];

export default function EventsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const pickForSetlist = route?.params?.pickForSetlist ?? false;

  const SORT_OPTIONS = useMemo(() => [
    { key: 'date_asc', label: t('events_sort_near') },
    { key: 'date_desc', label: t('events_sort_far') },
    { key: 'name_asc', label: t('events_sort_az') },
  ], [t]);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState(launchCityOrNull(session.userCity));
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [sortKey, setSortKey] = useState('date_asc');
  const [showPast, setShowPast] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [layout, setLayout] = useState('row');

  useEffect(() => {
    AsyncStorage.getItem(LAYOUT_KEY)
      .then(v => { if (v && LAYOUTS.some(l => l.key === v)) setLayout(v); })
      .catch(() => {});
  }, []);
  const chooseLayout = useCallback((key) => {
    setLayout(key);
    AsyncStorage.setItem(LAYOUT_KEY, key).catch(() => {});
  }, []);

  // Arama ekranı / ana sayfadaki tür kısayolundan gelindiyse o türle aç
  const genreParam = route?.params?.genre;
  useEffect(() => {
    if (!genreParam) return;
    setSelectedGenre(genreParam);
    setShowPast(false);
    navigation.setParams({ genre: undefined });   // aynı türe tekrar basılabilsin
  }, [genreParam]);

  const isMounted = useRef(true);
  // Hızlı şehir/sekme değişiminde eski cevabın yeniyi ezmesini engeller.
  const latestRequest = useRef(0);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  /**
   * Konserleri backend'den çeker.
   *
   * Sayfalı uç kullanılıyor: ilk sayfa gelir gelmez liste görünür, kalan
   * sayfalar arkadan eklenir. Ekranın arama/sıralama/tarih filtreleri listenin
   * tamamı üzerinde çalıştığı için sayfaları biriktiriyoruz.
   *
   * Yaklaşan/geçmiş ayrımını artık sunucu yapıyor (past parametresi).
   */
  const fetchEvents = useCallback((city, past) => {
    const activeCity = city !== undefined ? city : selectedCity;
    const activePast = past !== undefined ? past : showPast;
    const requestId = ++latestRequest.current;
    const stale = () => !isMounted.current || requestId !== latestRequest.current;

    setLoadError(false);
    return fetchAllConcerts({
      city: activeCity,
      past: activePast,
      isCancelled: stale,
      onPage: (items, isFirstPage) => {
        if (stale()) return;
        setEvents(prev => {
          if (isFirstPage) return items;
          const seen = new Set(prev.map(e => e.id));
          return [...prev, ...items.filter(e => !seen.has(e.id))];
        });
      },
    }).catch(err => {
      if (stale()) return;
      console.log('Konser listesi alınamadı:', err.message);
      setLoadError(true);
      setEvents([]);
    });
  }, [selectedCity, showPast]);

  // Şehir ya da yaklaşan/geçmiş seçimi değişince yeniden çekilir.
  useEffect(() => {
    setLoading(true);
    fetchEvents().finally(() => {
      setTimeout(() => { if (isMounted.current) setLoading(false); }, 300);
    });
  }, [selectedCity, showPast]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents().finally(() => { if (isMounted.current) setRefreshing(false); });
  }, [fetchEvents]);

  const handleCitySelect = (city) => {
    const val = city === 'Tümü' ? null : city;
    setSelectedCity(val);
    setCityModalVisible(false);
  };

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let list = events.filter(e =>
      showPast ? parseEventDate(e.eventDate) < today : parseEventDate(e.eventDate) >= today
    );

    if (search.trim()) {
      // Türkçe harf / büyük-küçük harf duyarsız ("sebnem" → "Şebnem", "istanbul" → "İstanbul")
      const q = foldSearch(search.trim());
      list = list.filter(e =>
        foldSearch(e.name).includes(q) ||
        foldSearch(e.artistName).includes(q) ||
        foldSearch(e.venueCity).includes(q) ||
        foldSearch(e.venueName).includes(q)
      );
    }

    if (selectedGenre) {
      list = list.filter(e => e.genre?.toLowerCase().includes(selectedGenre.toLowerCase()));
    }

    if (startDate.trim()) {
      const [d, m, y] = startDate.split('.');
      const start = parseEventDate(`${y}-${m}-${d}`);
      if (!isNaN(start)) list = list.filter(e => parseEventDate(e.eventDate) >= start);
    }

    if (endDate.trim()) {
      const [d, m, y] = endDate.split('.');
      const end = parseEventDate(`${y}-${m}-${d}`);
      end.setHours(23, 59, 59);
      if (!isNaN(end)) list = list.filter(e => parseEventDate(e.eventDate) <= end);
    }

    // "Yakın tarih" (varsayılan): yaklaşanlarda en yakın gelecek, Geçmiş'te en yeni önce —
    // sunucunun /concerts?past=true sırasıyla aynı. Eskiden Geçmiş önce yeniden eskiye
    // sıralanıp burada tekrar eskiden yeniye çevriliyordu. Eşit tarihte id ile sabit sıra.
    const byDate = (a, b) => (parseEventDate(a.eventDate) - parseEventDate(b.eventDate)) || (a.id - b.id);
    const nearFirst = showPast ? (a, b) => byDate(b, a) : byDate;
    if (sortKey === 'date_asc') list.sort(nearFirst);
    else if (sortKey === 'date_desc') list.sort((a, b) => nearFirst(b, a));
    else if (sortKey === 'name_asc') list.sort((a, b) => (a.name || '').localeCompare(b.name || '') || (a.id - b.id));

    return list;
  }, [events, search, selectedGenre, sortKey, startDate, endDate, showPast]);

  // Ticketmaster'ın birçok sanatçıda tekrar eden genel görselleri: bu kartlarda
  // sanatçının kendi fotoğrafı öne alınır.
  const genericImages = useMemo(() => findGenericImages(events), [events]);

  const renderItem = useCallback(({ item, index }) => (
    <AnimatedListItem index={index} style={layout === 'tile' ? styles.tileCell : null}>
      <EventCard
        item={item}
        variant={layout}
        genericImages={genericImages}
        onPress={() => pickForSetlist
          ? navigation.navigate('SetlistPrediction', { eventId: item.id })
          : openEvent(navigation, item)}
      />
    </AnimatedListItem>
  ), [styles, navigation, pickForSetlist, genericImages, layout]);

  if (loading) return (
    <View style={styles.skeletonContainer}>
      <EventsSkeletonPage />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        {pickForSetlist && (
          <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.pickerBack} activeOpacity={0.7}>
            <Text style={styles.pickerBackText}>{t('back')}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t('events_header_title')}</Text>
            <Text style={styles.headerSub}>{t('events_count', { count: filtered.length })}</Text>
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
              <Ionicons name="options-outline" size={17} color={(selectedGenre || sortKey !== 'date_asc') ? colors.primary : colors.textSecondary} />
              <Text style={[styles.headerBtnText, { color: (selectedGenre || sortKey !== 'date_asc') ? colors.primary : colors.textSecondary }]}>{t('events_filter')}</Text>
              {(selectedGenre || sortKey !== 'date_asc') && <View style={[styles.filterDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('events_search_hint')}
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

        {/* YAKLAŞAN / GEÇMİŞ TOGGLE */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            onPress={() => setShowPast(false)}
            style={[styles.togglePill, !showPast && { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={15} color={!showPast ? '#fff' : colors.textSecondary} />
            <Text style={[styles.toggleText, { color: !showPast ? '#fff' : colors.textSecondary }]}>
              {t('events_upcoming')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowPast(true)}
            style={[styles.togglePill, showPast && { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={15} color={showPast ? '#fff' : colors.textSecondary} />
            <Text style={[styles.toggleText, { color: showPast ? '#fff' : colors.textSecondary }]}>
              {t('events_past')}
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={[styles.layoutSwitch, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {LAYOUTS.map(l => {
              const active = layout === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  onPress={() => chooseLayout(l.key)}
                  style={[styles.layoutBtn, active && { backgroundColor: colors.primary }]}
                  accessibilityLabel={t(l.label)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={l.icon} size={16} color={active ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </LinearGradient>

      {pickForSetlist && (
        <View style={styles.setlistBanner}>
          <Text style={styles.setlistBannerText}>{t('events_pick_setlist')}</Text>
        </View>
      )}

      <FlatList
        key={layout === 'tile' ? 'grid' : 'single'}
        data={filtered}
        numColumns={layout === 'tile' ? 2 : 1}
        columnWrapperStyle={layout === 'tile' ? styles.gridRow : undefined}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={11}
        removeClippedSubviews
        ListEmptyComponent={
          loadError ? (
            // Hata ile "sonuç yok" ayrı durumlar: kullanıcı tekrar deneyebilmeli.
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📡</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('events_load_error')}
              </Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                onPress={() => { setLoading(true); fetchEvents().finally(() => setLoading(false)); }}
                activeOpacity={0.85}
              >
                <Text style={styles.retryBtnText}>{t('events_retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎭</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('events_empty')}</Text>
            </View>
          )
        }
      />

      {/* FİLTRE MODAL */}
      <Modal visible={filterModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
        <View style={[styles.cityModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={[styles.cityModalTitle, { color: colors.text, marginBottom: 0 }]}>{t('events_filter')}</Text>
            <TouchableOpacity onPress={() => { setSelectedGenre(null); setSortKey('date_asc'); setStartDate(''); setEndDate(''); }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{t('events_reset')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.filterSectionLabel, { color: colors.textSecondary }]}>{t('events_filter_genre')}</Text>
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

          <Text style={[styles.filterSectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>{t('events_filter_date_range')}</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateInputWrap}>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('events_filter_start')}</Text>
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
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{t('events_filter_end')}</Text>
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

          <Text style={[styles.filterSectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>{t('events_filter_sort')}</Text>
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
            <Text style={styles.applyBtnText}>{t('events_apply')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ŞEHİR MODAL */}
      <Modal visible={cityModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCityModalVisible(false)} />
        <View style={[styles.cityModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cityModalTitle, { color: colors.text }]}>{t('events_city_select')}</Text>
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
                    {city === 'Tümü' ? t('events_all_turkey') : `📍 ${city}`}
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
    skeletonContainer: { flex: 1, backgroundColor: colors.background, paddingTop: 140 },

    header: { paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20 },
    pickerBack: { marginBottom: 10 },
    pickerBackText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
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

    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    // Sabit yükseklik + iki eksende ortalama: yazı ve ikon hapın tam ortasında,
    // sağdaki görünüm düğmeleriyle aynı hizada.
    togglePill: {
      height: 38, paddingHorizontal: 14, borderRadius: 19,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    toggleText: { fontSize: 13.5, fontWeight: '800', lineHeight: 18, textAlignVertical: 'center', includeFontPadding: false },

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

    setlistBanner: { backgroundColor: '#E9456022', borderBottomWidth: 1, borderBottomColor: '#E9456044', paddingVertical: 11, paddingHorizontal: 20 },
    setlistBannerText: { color: '#E94560', fontSize: 13, fontWeight: '800', textAlign: 'center' },

    list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
    gridRow: { gap: 12 },
    tileCell: { flex: 1, maxWidth: '50%' },
    layoutSwitch: { flexDirection: 'row', alignItems: 'center', height: 38, borderWidth: 1, borderRadius: 12, paddingHorizontal: 3, gap: 2 },
    layoutBtn: { width: 34, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

    empty: { alignItems: 'center', marginTop: 80 },
    emptyEmoji: { fontSize: 56, marginBottom: 12 },
    emptyText: { fontSize: 15, textAlign: 'center' },
    retryBtn: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
    retryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    cityModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 40, maxHeight: '60%' },
    cityModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    cityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10, marginBottom: 3 },
    cityOptionText: { fontSize: 15 },
  });
}
