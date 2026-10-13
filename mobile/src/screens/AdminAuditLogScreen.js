import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { dateLocale } from '../utils/time';

// Kayıttaki adresi okunur cümleye çevirir. Sıra önemli: ilk eşleşen kazanır.
// [yöntem, adres deseni, çeviri anahtarı, simge]
const ACTIONS = [
  ['PUT', /^\/api\/admin\/settings$/, 'admin_audit_settings', 'options-outline'],
  ['PATCH', /^\/api\/admin\/users\/(\d+)\/ban$/, 'admin_audit_user_ban', 'ban-outline'],
  ['PATCH', /^\/api\/admin\/users\/(\d+)\/unban$/, 'admin_audit_user_unban', 'checkmark-circle-outline'],
  ['POST', /^\/api\/admin\/users\/(\d+)\/suspend$/, 'admin_audit_user_ban', 'ban-outline'],
  ['POST', /^\/api\/admin\/users\/(\d+)\/reinstate$/, 'admin_audit_user_unban', 'checkmark-circle-outline'],
  ['POST', /^\/api\/admin\/users\/(\d+)\/warn$/, 'admin_audit_user_warn', 'warning-outline'],
  ['POST', /^\/api\/admin\/users\/(\d+)\/notes$/, 'admin_audit_user_note', 'document-text-outline'],
  ['POST', /^\/api\/admin\/users\/(\d+)\/badges\/[\w-]+$/, 'admin_audit_user_badge_give', 'ribbon-outline'],
  ['DELETE', /^\/api\/admin\/users\/(\d+)\/badges\/[\w-]+$/, 'admin_audit_user_badge_take', 'ribbon-outline'],
  ['PATCH', /^\/api\/admin\/users\/(\d+)\/make-admin$/, 'admin_audit_user_make_admin', 'shield-outline'],
  ['PATCH', /^\/api\/admin\/users\/(\d+)\/remove-admin$/, 'admin_audit_user_remove_admin', 'shield-half-outline'],
  ['POST', /^\/api\/admin\/events$/, 'admin_audit_event_create', 'add-circle-outline'],
  ['PUT', /^\/api\/admin\/events\/(\d+)$/, 'admin_audit_event_edit', 'create-outline'],
  ['DELETE', /^\/api\/admin\/events\/(\d+)$/, 'admin_audit_event_delete', 'trash-outline'],
  ['PATCH', /^\/api\/admin\/events\/(\d+)\/approve$/, 'admin_audit_event_approve', 'checkmark-done-outline'],
  ['POST', /^\/api\/admin\/events\/(\d+)\/cancel$/, 'admin_audit_event_cancel', 'close-circle-outline'],
  ['POST', /^\/api\/admin\/events\/(\d+)\/uncancel$/, 'admin_audit_event_uncancel', 'refresh-outline'],
  ['DELETE', /^\/api\/admin\/posts\/(\d+)$/, 'admin_audit_post_delete', 'trash-outline'],
  ['PATCH', /^\/api\/admin\/reports\/(\d+)\/resolve$/, 'admin_audit_report_resolve', 'flag-outline'],
  ['POST', /^\/api\/admin\/moderation\/hide$/, 'admin_audit_moderation_hide', 'eye-off-outline'],
  ['POST', /^\/api\/admin\/moderation\/queue\/action$/, 'admin_audit_mq_action', 'shield-checkmark-outline'],
  ['POST', /^\/api\/admin\/claims\/(\d+)\/approve$/, 'admin_audit_claim_approve', 'hand-left-outline'],
  ['POST', /^\/api\/admin\/claims\/(\d+)\/reject$/, 'admin_audit_claim_reject', 'hand-left-outline'],
  ['POST', /^\/api\/admin\/moderation\/queue\/bulk$/, 'admin_audit_mq_bulk', 'layers-outline'],
  ['POST', /^\/api\/admin\/communities\/(\d+)\/approve$/, 'admin_audit_community_approve', 'people-outline'],
  ['POST', /^\/api\/admin\/communities\/(\d+)\/reject$/, 'admin_audit_community_reject', 'people-outline'],
  ['PATCH', /^\/api\/admin\/cities\/(\d+)$/, 'admin_audit_city', 'map-outline'],
  ['POST', /^\/api\/admin\/organizer-requests\/(\d+)\/approve$/, 'admin_audit_organizer_approve', 'ribbon-outline'],
  ['POST', /^\/api\/admin\/organizer-requests\/(\d+)\/reject$/, 'admin_audit_organizer_reject', 'ribbon-outline'],
  ['PUT', /^\/api\/admin\/organizer-requests\/(\d+)\/note$/, 'admin_audit_organizer_note', 'create-outline'],
  ['PATCH', /^\/api\/admin\/organizers\/(\d+)$/, 'admin_audit_organizer_update', 'business-outline'],
  ['POST', /^\/api\/admin\/sources\/([A-Z_]+)\/sync$/, 'admin_audit_source_sync', 'sync-outline'],
  ['PUT', /^\/api\/admin\/artists\/(\d+)$/, 'admin_audit_artist_edit', 'mic-outline'],
  ['PUT', /^\/api\/admin\/venues\/(\d+)$/, 'admin_audit_venue_edit', 'location-outline'],
  ['POST', /^\/api\/admin\/merge\/artists\/(\d+)\/into\/\d+$/, 'admin_audit_artist_merge', 'git-merge-outline'],
  ['POST', /^\/api\/admin\/merge\/venues\/(\d+)\/into\/\d+$/, 'admin_audit_venue_merge', 'git-merge-outline'],
  [null, /^\/api\/admin\/merge\//, 'admin_audit_merge', 'git-merge-outline'],
  [null, /^\/api\/admin\/artists\//, 'admin_audit_artists', 'mic-outline'],
];

// Üstteki süzgeçler: sunucuya "area" olarak gider (/api/admin/<area> ile başlayanlar)
const AREAS = [
  [null, 'admin_audit_all'],
  ['settings', 'admin_audit_area_settings'],
  ['users', 'admin_audit_area_users'],
  ['events', 'admin_audit_area_events'],
  ['posts', 'admin_audit_area_posts'],
  ['reports', 'admin_audit_area_reports'],
  ['moderation', 'admin_audit_area_moderation'],
  ['artists', 'admin_audit_area_artists'],
  ['venues', 'admin_audit_area_venues'],
  ['organizer', 'admin_audit_area_organizers'],
  ['communities', 'admin_audit_area_communities'],
  ['cities', 'admin_audit_area_cities'],
  ['sources', 'admin_audit_area_sources'],
];

function describe(item, t) {
  for (const [method, re, key, icon] of ACTIONS) {
    if (method && method !== item.method) continue;
    const m = item.path.match(re);
    if (m) return { text: t(key, { id: m[1] }), icon };
  }
  return { text: `${item.method} ${item.path.replace(/^\/api\/admin/, '')}`, icon: 'ellipse-outline' };
}

/** Admin işlem kaydı: kim, ne zaman, ne yaptı. Ayar değişikliklerinde "eski → yeni" ayrıntısı. */
export default function AdminAuditLogScreen({ navigation }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [area, setArea] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(() => new Set());

  const load = useCallback(async (nextPage, append) => {
    try {
      const res = await API.get('/admin/audit', { params: { page: nextPage, size: 30, area: area || undefined } });
      const data = res.data || {};
      setItems(prev => (append ? [...prev, ...(data.items || [])] : (data.items || [])));
      setPage(nextPage);
      setHasMore(!!data.hasMore);
      setError(false);
    } catch {
      if (!append) setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [area]);

  useEffect(() => {
    setLoading(true);
    load(0, false);
  }, [load]);

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    load(page + 1, true);
  };

  const toggle = (id) => setOpen(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const renderItem = ({ item }) => {
    const { text, icon } = describe(item, t);
    const when = new Date(item.createdAt).toLocaleString(dateLocale(lang), {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    const expanded = open.has(item.id);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => item.detail && toggle(item.id)}
        disabled={!item.detail}
        activeOpacity={0.8}
        accessibilityRole={item.detail ? 'button' : 'text'}
        accessibilityState={item.detail ? { expanded } : undefined}
      >
        <View style={styles.icon}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.body}>
          <Text style={styles.text}>{text}</Text>
          <Text style={styles.meta}>{`@${item.adminName || '?'} · ${when}`}</Text>
          {item.detail && expanded ? <Text style={styles.detail}>{item.detail}</Text> : null}
        </View>
        {item.detail ? (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_nav_audit_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {AREAS.map(([key, label]) => {
            const on = area === key;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => setArea(key)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(label)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[items.length === 0 && styles.emptyContainer, { paddingBottom: insets.bottom + 24 }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0, false); }} tintColor={colors.primary} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name={error ? 'cloud-offline-outline' : 'document-text-outline'} size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{error ? t('admin_audit_load_error') : t('admin_audit_empty')}</Text>
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

    chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    chip: {
      borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
      paddingHorizontal: 12, paddingVertical: 7,
    },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
    chipTextOn: { color: '#fff' },

    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    icon: {
      width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
      backgroundColor: `${colors.primary}14`,
    },
    body: { flex: 1 },
    text: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 19 },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
    detail: {
      marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.text,
      fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
      backgroundColor: colors.card, borderRadius: 10, padding: 10, overflow: 'hidden',
    },
    separator: { height: 1, backgroundColor: colors.border, marginLeft: 62 },

    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  });
}
