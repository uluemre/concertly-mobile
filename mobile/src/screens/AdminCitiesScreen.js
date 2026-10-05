import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Switch,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { loadLaunchCities } from '../services/launchCities';
import { apiErrorMessage } from '../utils/communityErrors';

/**
 * Şehir kapsamı: hangi şehirlerdeki konserler listelenir ve bilet sitelerinden taranır.
 * Açılan şehir bir sonraki gece senkronunda taranmaya başlar.
 */
export default function AdminCitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const pending = useRef(new Set());

  const fetchCities = useCallback(async () => {
    try {
      const res = await API.get('/admin/cities');
      setCities(res.data || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCities(); }, [fetchCities]);

  const toggle = async (city, enabled) => {
    if (pending.current.has(city.id)) return;
    pending.current.add(city.id);
    // İyimser güncelleme; hata olursa geri alınır
    setCities(prev => prev.map(c => (c.id === city.id ? { ...c, enabled } : c)));
    try {
      await API.patch(`/admin/cities/${city.id}`, { enabled });
      loadLaunchCities(); // uygulamanın kendi şehir listesi de tazelensin
    } catch (err) {
      setCities(prev => prev.map(c => (c.id === city.id ? { ...c, enabled: !enabled } : c)));
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), code === 'LAST_CITY' ? t('admin_cities_last') : apiErrorMessage(err, t));
    } finally {
      pending.current.delete(city.id);
    }
  };

  const fold = (s) => (s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i');
  const visible = useMemo(() => {
    const q = fold(query.trim());
    return q ? cities.filter(c => fold(c.name).includes(q)) : cities;
  }, [cities, query]);
  const openCount = cities.filter(c => c.enabled).length;

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          {t('admin_cities_upcoming', { count: item.upcomingEvents })}
        </Text>
      </View>
      <Switch
        value={item.enabled}
        onValueChange={(v) => toggle(item, v)}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#fff"
        accessibilityLabel={item.name}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_nav_cities_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.top}>
        <Text style={styles.summary}>{t('admin_cities_summary', { count: openCount })}</Text>
        <Text style={styles.hint}>{t('admin_cities_hint')}</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('admin_cities_search')}
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={visible.length === 0 && styles.emptyContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCities(); }} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={error ? 'cloud-offline-outline' : 'map-outline'} size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{error ? t('admin_cities_load_error') : t('admin_cities_empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    top: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 6 },
    summary: { fontSize: 15, fontWeight: '700', color: colors.text },
    hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    search: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },

    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    rowText: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 16 },

    emptyContainer: { flex: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary },
  });
}
