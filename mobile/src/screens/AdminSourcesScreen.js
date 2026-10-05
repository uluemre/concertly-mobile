import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { formatTimeAgo, dateLocale } from '../utils/time';

// Sunucunun durum / neden kodları → çeviri anahtarı
const STATUS_KEYS = { OK: 'src_status_ok', WARN: 'src_status_warn', FAIL: 'src_status_fail' };
const REASON_KEYS = {
  NEVER_RAN: 'src_reason_never_ran',
  FAILED: 'src_reason_failed',
  EMPTY: 'src_reason_empty',
  DROPPED: 'src_reason_dropped',
  STALE: 'src_reason_stale',
};

/** Bilet sitelerinden veri çekme durumu: kaynak başına son koşular ve sağlık. */
export default function AdminSourcesScreen({ navigation }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await API.get('/admin/sources/health');
      setReport(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const statusColor = (status) => (
    status === 'OK' ? colors.accent : status === 'WARN' ? colors.secondary : colors.primary
  );

  const shortDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const renderItem = ({ item }) => {
    const color = statusColor(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.sourceName}>{item.source}</Text>
          <View style={[styles.statusChip, { borderColor: color }]}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={[styles.statusText, { color }]}>{t(STATUS_KEYS[item.status] || 'src_status_warn')}</Text>
          </View>
        </View>

        {item.reason ? (
          <Text style={styles.reason}>{REASON_KEYS[item.reason] ? t(REASON_KEYS[item.reason]) : item.reason}</Text>
        ) : null}

        {item.lastRunAt ? (
          <Text style={styles.meta}>
            {t('src_last_run')}: {formatTimeAgo(item.lastRunAt, lang)}
            {' · '}{t('src_records', { count: item.lastProcessed ?? 0 })}
            {item.typicalProcessed != null ? ` · ${t('src_typical', { count: item.typicalProcessed })}` : ''}
          </Text>
        ) : null}

        {item.lastError ? <Text style={styles.errorText} numberOfLines={3}>{item.lastError}</Text> : null}

        {item.recent?.length > 1 && (
          <View style={styles.history}>
            {item.recent.map((r, i) => (
              <View key={`${r.startedAt}-${i}`} style={styles.historyItem}>
                <Text style={styles.historyDate}>{shortDate(r.startedAt)}</Text>
                <Text style={[styles.historyCount, r.failed && { color: colors.primary }]}>
                  {r.failed ? t('src_failed_short') : r.processed}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const sources = report?.sources || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_nav_sources_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {report?.running && (
        <View style={styles.runningBar}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.runningText}>{t('src_running')}</Text>
        </View>
      )}

      <FlatList
        data={sources}
        keyExtractor={(item) => item.source}
        renderItem={renderItem}
        contentContainerStyle={sources.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchHealth(); }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={error ? 'cloud-offline-outline' : 'server-outline'} size={48} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>{error ? t('src_load_error') : t('src_empty')}</Text>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    runningBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    runningText: { fontSize: 13, color: colors.text, fontWeight: '600' },

    list: { padding: 16, gap: 12 },
    card: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, padding: 14,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sourceName: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
    statusChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: '700' },
    reason: { fontSize: 13, color: colors.text, marginTop: 10 },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
    errorText: { fontSize: 12, color: colors.primary, marginTop: 6 },

    history: {
      flexDirection: 'row', justifyContent: 'space-between',
      marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
    },
    historyItem: { alignItems: 'center', flex: 1 },
    historyDate: { fontSize: 11, color: colors.textSecondary },
    historyCount: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 },

    emptyContainer: { flex: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
    emptyIcon: { marginBottom: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  });
}
