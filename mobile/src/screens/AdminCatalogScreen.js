import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';

// Sanatçı ve mekân listesi aynı ekranı kullanır; fark yalnız uç ve satır metni
export const CATALOG_KINDS = {
  artists: { endpoint: '/admin/artists', titleKey: 'admin_nav_artists_title', icon: 'mic-outline', searchKey: 'admin_cat_search_artists' },
  venues: { endpoint: '/admin/venues', titleKey: 'admin_nav_venues_title', icon: 'location-outline', searchKey: 'admin_cat_search_venues' },
};

/** Admin: sanatçı / mekân arama ve listesi. Satıra dokununca düzenleme ekranı açılır. */
export default function AdminCatalogScreen({ navigation, route }) {
  const kind = route?.params?.kind === 'venues' ? 'venues' : 'artists';
  const cfg = CATALOG_KINDS[kind];
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (q, nextPage, append) => {
    const id = ++requestId.current;
    try {
      const res = await API.get(cfg.endpoint, { params: { q: q || undefined, page: nextPage } });
      if (id !== requestId.current) return; // eski aramanın sonucu yenisini ezmesin
      const rows = res.data || [];
      setItems(prev => (append ? [...prev, ...rows] : rows));
      setPage(nextPage);
      setHasMore(rows.length >= 30);
      setError(false);
    } catch {
      if (id === requestId.current && !append) setError(true);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [cfg.endpoint]);

  // Yazmayı bırakınca ara
  useEffect(() => {
    const timer = setTimeout(() => load(query.trim(), 0, false), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, load]);

  // Düzenlemeden dönünce liste tazelensin (ad / fotoğraf değişmiş olabilir)
  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    load(query.trim(), 0, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]));

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    load(query.trim(), page + 1, true);
  };

  const subtitle = (item) => {
    const parts = [];
    if (kind === 'artists') {
      if (item.genre) parts.push(item.genre);
      parts.push(t('admin_cat_upcoming', { count: item.upcoming }));
      parts.push(t('admin_cat_followers', { count: item.followers }));
    } else {
      if (item.city) parts.push(item.city);
      parts.push(t('admin_cat_upcoming', { count: item.upcoming }));
    }
    return parts.join(' · ');
  };

  const renderItem = ({ item }) => {
    const manual = kind === 'artists' ? item.imageSource === 'ADMIN' : item.adminEdited;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('AdminCatalogEdit', { kind, id: item.id, name: item.name })}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${subtitle(item)}`}
      >
        <View style={[styles.thumb, kind === 'artists' && styles.thumbRound]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={100} />
          ) : (
            <Ionicons name={cfg.icon} size={22} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.rowText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {manual ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t('admin_cat_manual')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>{subtitle(item)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t(cfg.titleKey)}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t(cfg.searchKey)}
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {!query ? <Text style={styles.hint}>{t('admin_cat_hint')}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[items.length === 0 && styles.emptyContainer, { paddingBottom: insets.bottom + 24 }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(query.trim(), 0, false); }} tintColor={colors.primary} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name={error ? 'cloud-offline-outline' : cfg.icon} size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{error ? t('admin_cat_load_error') : t('admin_cat_empty')}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },

    searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 6 },
    search: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
    hint: { fontSize: 12, color: colors.textSecondary },

    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
    thumb: {
      width: 48, height: 48, borderRadius: 10, overflow: 'hidden',
      backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
    },
    thumbRound: { borderRadius: 24 },
    rowText: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    badge: { backgroundColor: `${colors.secondary}26`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    badgeText: { color: colors.secondary, fontSize: 10, fontWeight: '700' },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },

    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  });
}
