import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/time';
import { goBackOrFallback } from '../navigation/navHelpers';

/**
 * Şikayet kuyruğu (admin).
 *
 * UGC barındıran bir uygulamanın App Store/Play koşulu: kullanıcı şikayet
 * edebilmeli ve şikayet incelenebilmeli. Gizleme silme değildir — içerik
 * akıştan düşer, kayıt denetim izi olarak kalır.
 */
export default function AdminReportsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchReports = useCallback(async (resolved = showResolved) => {
    try {
      const res = await API.get('/admin/moderation/reports', { params: { resolved } });
      setReports(res.data || []);
    } catch {
      Alert.alert(t('error'), t('admin_reports_load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showResolved, t]);

  useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

  const toggleFilter = (resolved) => {
    setShowResolved(resolved);
    setLoading(true);
    fetchReports(resolved);
  };

  const hideContent = async (report, hidden) => {
    setBusyId(report.id);
    try {
      await API.post('/admin/moderation/hide', {
        targetType: report.targetType,
        targetId: report.targetId,
        hidden,
      });
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, targetHidden: hidden } : r))
      );
    } catch (err) {
      Alert.alert(t('error'), err.response?.data?.message || t('admin_reports_action_error'));
    } finally {
      setBusyId(null);
    }
  };

  const resolve = async (report) => {
    setBusyId(report.id);
    try {
      await API.patch(`/admin/moderation/reports/${report.id}/resolve`);
      setReports((prev) => prev.filter((r) => r.id !== report.id || showResolved));
      if (showResolved) fetchReports(true);
    } catch {
      Alert.alert(t('error'), t('admin_reports_action_error'));
    } finally {
      setBusyId(null);
    }
  };

  const canHide = (type) => type === 'POST' || type === 'COMMENT';

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{item.targetType}</Text>
        </View>
        <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
      </View>

      {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}

      <View style={styles.previewBox}>
        <Text style={styles.previewText} numberOfLines={5}>
          {item.targetPreview || t('admin_reports_no_preview')}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {t('admin_reports_reporter')}: @{item.reporterUsername || '—'}
        </Text>
        {item.targetOwnerUsername ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { userId: item.targetOwnerId })}
          >
            <Text style={[styles.meta, styles.metaLink]}>@{item.targetOwnerUsername}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {item.targetHidden ? (
        <View style={styles.hiddenTag}>
          <Text style={styles.hiddenTagText}>{t('admin_reports_hidden')}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {canHide(item.targetType) ? (
          <TouchableOpacity
            style={[styles.actionBtn, item.targetHidden ? styles.actionGhost : styles.actionDanger]}
            onPress={() => hideContent(item, !item.targetHidden)}
            disabled={busyId === item.id}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionText, item.targetHidden && styles.actionGhostText]}>
              {item.targetHidden ? t('admin_reports_unhide') : t('admin_reports_hide')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!item.resolved ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionPrimary]}
            onPress={() => resolve(item)}
            disabled={busyId === item.id}
            activeOpacity={0.85}
          >
            <Text style={styles.actionText}>{t('admin_reports_resolve')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrFallback(navigation, 'Admin')}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_reports_title')}</Text>
        <Text style={styles.headerSub}>{t('admin_reports_subtitle')}</Text>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !showResolved && styles.filterChipActive]}
            onPress={() => toggleFilter(false)}
          >
            <Text style={[styles.filterText, !showResolved && styles.filterTextActive]}>
              {t('admin_reports_filter_open')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, showResolved && styles.filterChipActive]}
            onPress={() => toggleFilter(true)}
          >
            <Text style={[styles.filterText, showResolved && styles.filterTextActive]}>
              {t('admin_reports_filter_all')}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchReports(); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🛡️</Text>
              <Text style={styles.emptyText}>{t('admin_reports_empty')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
    backButton: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
      marginBottom: 16,
    },
    backText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
    filterRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    filterChipActive: { backgroundColor: '#fff' },
    filterText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    filterTextActive: { color: colors.primary },
    listContent: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    typeBadge: {
      backgroundColor: colors.background, borderRadius: 8,
      paddingHorizontal: 9, paddingVertical: 4,
      borderWidth: 1, borderColor: colors.border,
    },
    typeBadgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    time: { color: colors.textSecondary, fontSize: 12 },
    reason: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 12 },
    previewBox: {
      backgroundColor: colors.background, borderRadius: 12, padding: 12, marginTop: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    previewText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 10 },
    meta: { color: colors.textSecondary, fontSize: 12 },
    metaLink: { color: colors.primary, fontWeight: '700' },
    hiddenTag: {
      alignSelf: 'flex-start', marginTop: 10,
      backgroundColor: 'rgba(233,69,96,0.15)', borderRadius: 8,
      paddingHorizontal: 9, paddingVertical: 4,
    },
    hiddenTagText: { color: '#E94560', fontSize: 11, fontWeight: '800' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: 'center' },
    actionDanger: { backgroundColor: '#E94560' },
    actionPrimary: { backgroundColor: colors.primary },
    actionGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    actionText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
    actionGhostText: { color: colors.text },
    empty: { alignItems: 'center', paddingTop: 70 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyText: { color: colors.textSecondary, fontSize: 15 },
  });
