import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { accountAge, orgTypeKey } from '../utils/adminOrganizer';

const STATUSES = [['PENDING', 'adm_org_status_pending'], ['APPROVED', 'adm_org_status_approved'], ['REJECTED', 'adm_org_status_rejected']];

/**
 * Admin organizatör merkezi: başvuru kuyruğu (durum süzgeciyle) ve onaylı organizatörler.
 * Satıra dokununca inceleme / yönetim ekranı açılır.
 */
export default function AdminOrganizerRequestsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState('requests');
  const [status, setStatus] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [organizers, setOrganizers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadRequests = useCallback(async (s) => {
    try {
      const res = await API.get('/admin/organizer-requests', { params: { status: s } });
      setRequests(res.data || []);
      if (s === 'PENDING') setPendingCount((res.data || []).length);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadOrganizers = useCallback(async (q) => {
    try {
      const res = await API.get('/admin/organizers', { params: { q: q || undefined } });
      setOrganizers(res.data || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // İncelemeden dönünce liste tazelensin (onaylanan/reddedilen kuyruktan düşer)
  useFocusEffect(useCallback(() => {
    if (tab === 'requests') loadRequests(status);
    else loadOrganizers(query.trim());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status, loadRequests, loadOrganizers]));

  useEffect(() => {
    if (tab !== 'organizers') return undefined;
    const timer = setTimeout(() => loadOrganizers(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, tab, loadOrganizers]);

  const switchTab = (next) => {
    if (next === tab) return;
    setLoading(true);
    setTab(next);
  };
  const switchStatus = (next) => {
    if (next === status) return;
    setLoading(true);
    setStatus(next);
  };

  const avatar = (uri, fallbackIcon, round = true) => (
    <View style={[styles.avatar, !round && styles.logo]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name={fallbackIcon} size={20} color={colors.textSecondary} />}
    </View>
  );

  const renderRequest = ({ item }) => {
    const risky = item.reports > 0 || !item.emailVerified || accountAge(item.accountCreatedAt).days < 7;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AdminOrganizerRequest', { id: item.id })}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <View style={styles.cardTop}>
          {avatar(item.profileImageUrl, 'person')}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.organizationName}</Text>
            <Text style={styles.meta} numberOfLines={1}>{`${t(orgTypeKey(item.type))} · @${item.username}`}</Text>
          </View>
          {risky ? <Ionicons name="warning" size={18} color={colors.secondary} accessibilityLabel={t('adm_org_risk')} /> : null}
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.signals}>
          <Signal icon="time-outline" text={accountAge(item.accountCreatedAt).label(t)} styles={styles} colors={colors} />
          <Signal icon="people-outline" text={t('adm_org_followers_n', { count: item.followers })} styles={styles} colors={colors} />
          <Signal icon="ticket-outline" text={t('adm_org_concerts_n', { count: item.concerts })} styles={styles} colors={colors} />
          {item.reports > 0 ? <Signal icon="flag" text={t('adm_org_reports_n', { count: item.reports })} styles={styles} colors={colors} danger /> : null}
        </View>
        {item.status !== 'PENDING' && item.reviewedBy ? (
          <Text style={styles.reviewed}>{t('adm_org_reviewed_by', { who: item.reviewedBy })}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderOrganizer = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('AdminOrganizerDetail', { id: item.id })}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <View style={styles.cardTop}>
        {avatar(item.logoUrl, 'business', false)}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {item.verified ? <Ionicons name="checkmark-circle" size={16} color={colors.accent} /> : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>{`${t(orgTypeKey(item.type))} · @${item.username}`}</Text>
        </View>
        {!item.active ? (
          <View style={styles.suspended}><Text style={styles.suspendedText}>{t('adm_org_suspended')}</Text></View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.signals}>
        <Signal icon="calendar-outline" text={t('adm_org_upcoming_n', { count: item.upcoming })} styles={styles} colors={colors} />
        <Signal icon="albums-outline" text={t('adm_org_events_n', { count: item.totalEvents })} styles={styles} colors={colors} />
        <Signal icon="eye-outline" text={t('adm_org_views_n', { count: item.views })} styles={styles} colors={colors} />
        {!item.canAnnounce ? <Signal icon="megaphone-outline" text={t('adm_org_no_announce')} styles={styles} colors={colors} danger /> : null}
      </View>
    </TouchableOpacity>
  );

  const data = tab === 'requests' ? requests : organizers;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('adm_org_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.segment}>
        {[['requests', t('adm_org_tab_requests', { count: pendingCount })], ['organizers', t('adm_org_tab_organizers')]].map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => switchTab(key)} style={[styles.segBtn, tab === key && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Text style={[styles.segText, tab === key && styles.segTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'requests' ? (
        <View style={styles.chips}>
          {STATUSES.map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => switchStatus(key)} style={[styles.chip, status === key && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: status === key }}>
              <Text style={[styles.chipText, status === key && styles.chipTextOn]}>{t(label)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('adm_org_search')}
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoCorrect={false}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={tab === 'requests' ? renderRequest : renderOrganizer}
          contentContainerStyle={[styles.list, data.length === 0 && styles.emptyContainer, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); if (tab === 'requests') loadRequests(status); else loadOrganizers(query.trim()); }}
              tintColor={colors.primary}
            />
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name={error ? 'cloud-offline-outline' : tab === 'requests' ? 'checkmark-done-outline' : 'business-outline'} size={44} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                {error ? t('adm_org_load_error')
                  : tab === 'organizers' ? t('adm_org_empty_organizers')
                  : status === 'PENDING' ? t('adm_org_empty_pending') : t('adm_org_empty')}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function Signal({ icon, text, styles, colors, danger }) {
  return (
    <View style={[styles.signal, danger && styles.signalDanger]}>
      <Ionicons name={icon} size={12} color={danger ? colors.primary : colors.textSecondary} />
      <Text style={[styles.signalText, danger && { color: colors.primary }]} numberOfLines={1}>{text}</Text>
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
    segment: {
      flexDirection: 'row', margin: 16, marginBottom: 10, padding: 4, borderRadius: 14,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
    segOn: { backgroundColor: colors.primary },
    segText: { fontWeight: '700', fontSize: 13, color: colors.textSecondary },
    segTextOn: { color: '#fff' },
    chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6 },
    chipOn: { backgroundColor: colors.text, borderColor: colors.text },
    chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    chipTextOn: { color: colors.background },
    search: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 6,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
    list: { padding: 16, paddingTop: 8, gap: 10 },
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: {
      width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
      backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
    },
    logo: { borderRadius: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    name: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    signals: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    signal: {
      flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8,
      backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4,
    },
    signalDanger: { backgroundColor: `${colors.primary}14` },
    signalText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    reviewed: { fontSize: 11, color: colors.textSecondary },
    suspended: { backgroundColor: `${colors.primary}1F`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    suspendedText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  });
}
