import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

// Backend'deki sebep kodu → çeviri anahtarı (SettingsScreen ile aynı kodlar).
const REASON_KEYS = {
  NOT_USING: 'settings_delete_reason_not_using',
  TOO_MANY_NOTIFICATIONS: 'settings_delete_reason_notifications',
  PRIVACY: 'settings_delete_reason_privacy',
  FOUND_ALTERNATIVE: 'settings_delete_reason_alternative',
  BUGS: 'settings_delete_reason_bugs',
  OTHER: 'settings_delete_reason_other',
};

export default function AdminDeletionFeedbackScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await API.get('/admin/deletion-feedback');
      setItems(res.data || []);
    } catch {
      // sessizce geç — boş liste gösterilir
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  // Sebep başına sayım (özet rozetleri için)
  const counts = useMemo(() => {
    const map = {};
    for (const it of items) map[it.reason] = (map[it.reason] || 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const reasonLabel = (code) => (REASON_KEYS[code] ? t(REASON_KEYS[code]) : code);

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0, 5);
    } catch { return ''; }
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.reason}>{reasonLabel(item.reason)}</Text>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
      {item.details ? <Text style={styles.details}>“{item.details}”</Text> : null}
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_nav_deletion_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {counts.length > 0 && (
        <View style={styles.summary}>
          {counts.map(([code, n]) => (
            <View key={code} style={styles.summaryChip}>
              <Text style={styles.summaryChipText}>{reasonLabel(code)} · {n}</Text>
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 && styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchFeedback(); }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>{t('admin_deletion_empty')}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    backText: { fontSize: 24, color: colors.text },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    summary: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    summaryChip: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    },
    summaryChipText: { fontSize: 12, color: colors.text, fontWeight: '600' },

    row: { paddingHorizontal: 16, paddingVertical: 14 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reason: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
    date: { fontSize: 12, color: colors.textSecondary, marginLeft: 8 },
    details: { fontSize: 14, color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },

    separator: { height: 1, backgroundColor: colors.border, marginLeft: 16 },
    emptyContainer: { flex: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary },
  });
}
