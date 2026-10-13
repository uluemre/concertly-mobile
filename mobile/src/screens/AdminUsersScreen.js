import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { accountAge } from '../utils/adminOrganizer';

const FILTERS = [
  ['all', 'admin_filter_all'],
  ['reported', 'adm_user_filter_reported'],
  ['new', 'adm_user_filter_new'],
  ['banned', 'admin_filter_banned'],
  ['admin', 'admin_filter_admin'],
];

/**
 * Admin kullanıcı listesi: sunucuda arama (kullanıcı adı, ad, e-posta) ve süzgeç; şikâyetli
 * kullanıcılar açık şikâyet sayısına göre sıralanır. Satıra dokununca kullanıcı detayı açılır.
 */
export default function AdminUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (q, f, nextPage, append) => {
    const id = ++requestId.current;
    try {
      const res = await API.get('/admin/users/search', { params: { q: q || undefined, filter: f, page: nextPage } });
      if (id !== requestId.current) return;
      const rows = res.data || [];
      setItems(prev => (append ? [...prev, ...rows] : rows));
      setPage(nextPage);
      setHasMore(rows.length >= 40);
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
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query.trim(), filter, 0, false), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, filter, load]);

  // Detaydan dönünce (yasak, uyarı...) liste tazelensin
  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    load(query.trim(), filter, 0, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]));

  const changeFilter = (f) => {
    if (f === filter) return;
    setLoading(true);
    setFilter(f);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    load(query.trim(), filter, page + 1, true);
  };

  const renderItem = ({ item }) => {
    const banned = item.isActive === false;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('AdminUserDetail', { id: item.id })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`@${item.username}`}
      >
        <View style={styles.avatar}>
          {item.profileImageUrl
            ? <Image source={{ uri: item.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <Text style={styles.avatarText}>{item.username?.charAt(0).toUpperCase() || '?'}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
            {item.isAdmin ? <Tag text={t('admin_badge_admin')} color={colors.purple} styles={styles} /> : null}
            {banned ? <Tag text={item.bannedUntil ? t('adm_user_banned_until_short') : t('admin_status_banned')} color={colors.primary} styles={styles} /> : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.fullName, item.email].filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.city, accountAge(item.createdAt).label(t)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {item.openReports > 0 ? (
          <View style={styles.reportBadge} accessibilityLabel={t('adm_org_reports_n', { count: item.openReports })}>
            <Ionicons name="flag" size={11} color="#fff" />
            <Text style={styles.reportText}>{item.openReports}</Text>
          </View>
        ) : null}
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
        <Text style={styles.headerTitle}>{t('admin_nav_users_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('adm_user_search')}
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => changeFilter(key)} style={[styles.chip, filter === key && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: filter === key }}>
              <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>{t(label)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[items.length === 0 && styles.emptyContainer, { paddingBottom: insets.bottom + 24 }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(query.trim(), filter, 0, false); }} tintColor={colors.primary} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name={error ? 'cloud-offline-outline' : 'people-outline'} size={44} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{error ? t('adm_org_load_error') : t('adm_user_empty')}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Tag({ text, color, styles }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
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
    search: {
      flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 4,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
    chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6 },
    chipOn: { backgroundColor: colors.text, borderColor: colors.text },
    chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    chipTextOn: { color: colors.background },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
    avatar: {
      width: 46, height: 46, borderRadius: 23, overflow: 'hidden',
      backgroundColor: `${colors.primary}22`, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.primary, fontFamily: fonts.headingBold, fontSize: 18 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    username: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    tagText: { fontSize: 10, fontWeight: '800' },
    reportBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
    reportText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 74 },
    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  });
}
