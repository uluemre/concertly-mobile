import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { communityTypeLabel } from '../utils/communityType';
import API, { getErrorMessage } from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import AdminBulkReviewBar from '../components/admin/AdminBulkReviewBar';

function waitingLabel(createdAt, t) {
  if (!createdAt) return '';
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return days <= 0 ? t('admin_communities_waiting_today') : t('admin_communities_waiting_days', { days });
}

export default function AdminCommunitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // "Tümü": gizli, reddedilmiş ve arşivlenmiş dahil bütün topluluklar (içeriğine girilebilir)
  const [tab, setTab] = useState('pending');
  const [query, setQuery] = useState('');
  const [all, setAll] = useState([]);
  const [allLoading, setAllLoading] = useState(false);

  const fetchAll = useCallback(async (q) => {
    setAllLoading(true);
    try {
      const res = await API.get('/admin/communities/all', { params: { q: q || undefined } });
      setAll(res.data || []);
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setAllLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab !== 'all') return undefined;
    const timer = setTimeout(() => fetchAll(query.trim()), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [tab, query, fetchAll]);

  const openCommunity = (id) => navigation.navigate('CommunityDetail', { communityId: id });

  const fetchPending = useCallback(async () => {
    try {
      const res = await API.get('/admin/communities/pending');
      setPending(res.data);
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { fetchPending(); }, [fetchPending]));

  const review = async (id, action) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await API.post(`/admin/communities/${id}/${action}`);
      setPending(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const bulkReview = (action) => {
    const targets = pending.slice();
    if (!targets.length || bulkBusy) return;
    const approve = action === 'approve';
    Alert.alert(
      t(approve ? 'admin_bulk_approve_title' : 'admin_bulk_reject_title', { count: targets.length }),
      t(approve ? 'admin_bulk_approve_msg' : 'admin_bulk_reject_msg', { count: targets.length }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t(approve ? 'admin_bulk_approve_all' : 'admin_bulk_reject_all'),
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            setBulkBusy(true);
            let success = 0;
            for (const item of targets) {
              try { await API.post(`/admin/communities/${item.id}/${action}`); success++; } catch { /* continue */ }
            }
            await fetchPending();
            Alert.alert(t('success'), t('admin_bulk_done', { success, total: targets.length }));
            setBulkBusy(false);
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); if (tab === 'all') fetchAll(query.trim()); else fetchPending(); }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_communities_title')}</Text>
        <View style={styles.tabs}>
          {[['pending', t('admin_communities_tab_pending', { count: pending.length })], ['all', t('admin_communities_tab_all')]].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'pending' && !loading ? (
        <AdminBulkReviewBar count={pending.length} busy={bulkBusy} colors={colors} t={t} onApprove={() => bulkReview('approve')} onReject={() => bulkReview('reject')} />
      ) : null}

      {tab === 'all' ? (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('admin_communities_search')}
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          <Text style={styles.hint}>{t('admin_communities_all_hint')}</Text>
          {allLoading && all.length === 0 ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : all.length === 0 ? (
            <Text style={styles.empty}>{t('admin_communities_all_empty')}</Text>
          ) : all.map(c => (
            <TouchableOpacity
              key={c.id}
              style={styles.row}
              onPress={() => openCommunity(c.id)}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.rowEmoji}><Text style={{ fontSize: 22 }}>{c.emoji || '🎵'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[
                    t(`admin_communities_vis_${String(c.visibility || 'PUBLIC').toLowerCase()}`),
                    t('admin_communities_members', { count: c.members }),
                    t('admin_communities_posts', { count: c.posts }),
                  ].join(' · ')}
                </Text>
                <Text style={styles.by} numberOfLines={1}>
                  {[
                    c.ownerUsername ? `@${c.ownerUsername}` : null,
                    c.approvalStatus && c.approvalStatus !== 'APPROVED' ? t(`admin_communities_status_${String(c.approvalStatus).toLowerCase()}`) : null,
                    c.archivedAt ? t('admin_communities_archived') : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </>
      ) : loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : pending.length === 0 ? (
        <Text style={styles.empty}>{t('admin_communities_empty')}</Text>
      ) : pending.map(c => (
        <View key={c.id} style={styles.card}>
          <TouchableOpacity style={styles.cardTop} onPress={() => openCommunity(c.id)} activeOpacity={0.8} accessibilityRole="button" accessibilityHint={t('admin_communities_open_hint')}>
            <LinearGradient colors={[c.gradientStart || '#7C3AED', c.gradientEnd || '#E94560']} style={styles.art}>
              <Text style={styles.emoji}>{c.emoji}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.meta}>
                {c.city ? `${c.city} · ` : ''}{communityTypeLabel(c.type, t)} · {c.visibility}
              </Text>
              <Text style={styles.by}>
                {c.ownerUsername ? t('admin_communities_by', { user: c.ownerUsername }) : ''} · {waitingLabel(c.createdAt, t)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {!!c.description && <Text style={styles.desc} numberOfLines={3}>{c.description}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => review(c.id, 'approve')}
              disabled={busyId === c.id}
              style={[styles.btn, styles.approveBtn]}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="checkmark" size={15} color={colors.accent} />
                <Text style={styles.approveText}>{t('admin_communities_approve')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => review(c.id, 'reject')}
              disabled={busyId === c.id}
              style={[styles.btn, styles.rejectBtn]}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="close" size={15} color={colors.primary} />
                <Text style={styles.rejectText}>{t('admin_communities_reject')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 22 },
    backButton: { alignSelf: 'flex-start', marginBottom: 12 },
    backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    headerTitle: { color: colors.text, fontSize: 26, fontFamily: fonts.heading },
    empty: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 60 },
    card: {
      marginHorizontal: 16, marginTop: 14, padding: 14,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    },
    cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    art: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 26 },
    name: { color: colors.text, fontSize: 16, fontWeight: '800' },
    meta: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
    by: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
    desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
    approveBtn: { backgroundColor: '#00D4AA', borderColor: '#00D4AA' },
    approveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    rejectBtn: { backgroundColor: 'transparent', borderColor: '#E94560' },
    rejectText: { color: '#E94560', fontSize: 14, fontWeight: '800' },
    tabs: { flexDirection: 'row', gap: 8, marginTop: 16 },
    tab: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.card },
    tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
    tabTextOn: { color: '#fff' },
    search: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
    hint: { color: colors.textSecondary, fontSize: 12, marginHorizontal: 18, marginTop: 8, marginBottom: 4, lineHeight: 17 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 10, padding: 12,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    },
    rowEmoji: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
  });
}
