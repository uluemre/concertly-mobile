import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl, Dimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';

const { width } = Dimensions.get('window');

// tint: tema rengi anahtarı — kartlar düz, rengi ikon taşır
const STAT_CARDS = [
  { key: 'totalUsers',       labelKey: 'admin_stat_total_users',    icon: 'people',           tint: 'accent' },
  { key: 'activeUsers',      labelKey: 'admin_stat_active_users',   icon: 'checkmark-circle', tint: 'accent' },
  { key: 'bannedUsers',      labelKey: 'admin_stat_banned_users',   icon: 'ban',              tint: 'primary' },
  { key: 'newUsersThisWeek', labelKey: 'admin_stat_new_week',       icon: 'person-add',       tint: 'accent' },
  { key: 'totalEvents',      labelKey: 'admin_stat_total_events',   icon: 'musical-notes',    tint: 'secondary' },
  { key: 'pendingEvents',    labelKey: 'admin_stat_pending_events', icon: 'hourglass',        tint: 'secondary' },
  { key: 'totalPosts',       labelKey: 'admin_stat_total_posts',    icon: 'document-text',    tint: 'purple' },
  { key: 'totalAttendance',  labelKey: 'admin_stat_attendance',     icon: 'ticket',           tint: 'primary' },
];

const NAV_ITEMS = [
  {
    titleKey: 'admin_nav_events_title',
    subtitleKey: 'admin_nav_events_sub',
    icon: 'musical-notes',
    tint: 'primary',
    screen: 'AdminEvents',
    badge: 'pendingEvents',
    badgeLabelKey: 'admin_badge_pending',
  },
  {
    titleKey: 'admin_nav_users_title',
    subtitleKey: 'admin_nav_users_sub',
    icon: 'people',
    tint: 'accent',
    screen: 'AdminUsers',
    badge: 'bannedUsers',
    badgeLabelKey: 'admin_badge_banned',
  },
  {
    titleKey: 'admin_nav_posts_title',
    subtitleKey: 'admin_nav_posts_sub',
    icon: 'document-text',
    tint: 'secondary',
    screen: 'AdminPosts',
    badge: 'totalPosts',
    badgeLabelKey: 'admin_badge_posts',
  },
  {
    titleKey: 'admin_nav_communities_title',
    subtitleKey: 'admin_nav_communities_sub',
    icon: 'people-circle',
    tint: 'purple',
    screen: 'AdminCommunities',
  },
  {
    titleKey: 'admin_nav_reports_title',
    subtitleKey: 'admin_nav_reports_sub',
    icon: 'shield-checkmark',
    tint: 'primary',
    screen: 'AdminReports',
  },
  {
    titleKey: 'admin_nav_organizer_title',
    subtitleKey: 'admin_nav_organizer_sub',
    icon: 'business',
    tint: 'accent',
    screen: 'AdminOrganizerRequests',
  },
  {
    titleKey: 'admin_nav_deletion_title',
    subtitleKey: 'admin_nav_deletion_sub',
    icon: 'file-tray',
    tint: 'textSecondary',
    screen: 'AdminDeletionFeedback',
  },
];

export default function AdminScreen({ navigation }) {
  const { colors } = useTheme();
  const { t, tu } = useLanguage();
  const { session } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [creatingConcert, setCreatingConcert] = useState(false);

  // Test için: bulunulan şehre koordinatsız (geofence'siz) sahte konser oluşturur,
  // böylece "konserde post" akışı yerinde olmadan denenebilir.
  const handleCreateTestConcert = async () => {
    if (creatingConcert) return;
    const city = session.userCity;
    if (!city) {
      Alert.alert(t('error'), t('admin_test_concert_no_city'));
      return;
    }
    setCreatingConcert(true);
    try {
      const d = new Date(Date.now() + 2 * 60 * 60 * 1000); // bugün, 2 saat sonrası
      const pad = (n) => String(n).padStart(2, '0');
      const eventDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      await API.post('/admin/events', {
        name: t('admin_test_concert_name'),
        description: t('admin_test_concert_desc'),
        eventDate,
        artistName: 'Test Sanatçı',
        artistGenre: 'Pop',
        venueName: 'Test Sahne',
        venueCity: city,
        venueCountry: 'Türkiye',
        // koordinat YOK → "konserde post" geofence olmadan direkt açılır
      });
      Alert.alert(t('success'), t('admin_test_concert_done', { city }));
      fetchStats();
    } catch {
      Alert.alert(t('error'), t('admin_test_concert_error'));
    } finally {
      setCreatingConcert(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      // Sync uzun sürebilir — varsayılan 15 sn timeout yetmez
      const res = await API.post('/events/sync', null, { timeout: 600000 });
      const msg = res.data?.message || (typeof res.data === 'string' ? res.data : 'Senkronizasyon tamamlandı!');
      Alert.alert(t('success'), msg);
      fetchStats();
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || t('admin_sync_error');
      console.log('Sync hatası:', err?.response?.status, errorMsg);
      Alert.alert(t('error'), `${t('admin_sync_error')} (${errorMsg})`);
    } finally {
      setSyncing(false);
    }
  };

  const handleEnrich = async () => {
    if (enriching) return;
    setEnriching(true);
    try {
      // Görsel/tür zenginleştirme tüm sanatçıları dolaşır — uzun sürebilir
      const res = await API.post('/events/enrich', null, { timeout: 600000 });
      const d = res.data || {};
      Alert.alert(
        t('success'),
        t('admin_enrich_done', { images: d.enrichedImages ?? 0, genres: d.enrichedGenres ?? 0 }),
      );
      fetchStats();
    } catch {
      Alert.alert(t('error'), t('admin_enrich_error'));
    } finally {
      setEnriching(false);
    }
  };

  const fetchStats = useCallback(async () => {
    setError(null);
    try {
      const res = await API.get('/admin/stats');
      setStats(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) {
        setError(t('admin_err_forbidden'));
      } else if (err.code === 'ERR_NETWORK') {
        setError(t('admin_err_network'));
      } else {
        setError(t('admin_err_stats'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { fetchStats(); }, [fetchStats]));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchStats(); }}
          tintColor={colors.primary}
        />
      }
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View style={[styles.headerBadge, styles.inlineRow]}>
          <Ionicons name="flash" size={11} color={colors.primary} />
          <Text style={styles.headerBadgeText}>ADMIN</Text>
        </View>
        <Text style={styles.headerTitle}>{t('admin_panel_title')}</Text>
        <Text style={styles.headerSub}>{t('admin_panel_sub')}</Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('MainApp')}
          style={styles.appBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.appBtnText}>{t('admin_back_to_app')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} style={styles.errorEmoji} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity onPress={fetchStats} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* STAT GRID */}
          <Text style={styles.sectionTitle}>{t('admin_overview')}</Text>
          <View style={styles.statsGrid}>
            {STAT_CARDS.map(card => (
              <View key={card.key} style={styles.statCard} accessible accessibilityLabel={`${t(card.labelKey)}: ${stats?.[card.key] ?? 0}`}>
                <Ionicons name={card.icon} size={22} color={colors[card.tint] || colors.primary} style={styles.statIcon} />
                <Text style={styles.statValue}>{stats?.[card.key] ?? 0}</Text>
                <Text style={styles.statLabel}>{t(card.labelKey)}</Text>
              </View>
            ))}
          </View>

          {/* QUICK ACTIONS */}
          <Text style={styles.sectionTitle}>{t('admin_quick_actions')}</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => navigation.navigate('AdminEvents', { openCreate: true })}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {/* Ana eylem: düz marka rengi */}
              <View style={[styles.quickBtnGrad, { backgroundColor: colors.primary }]}>
                <Ionicons name="add-circle" size={22} color="#fff" style={styles.quickBtnIcon} />
                <Text style={styles.quickBtnText}>{t('admin_add_event')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => navigation.navigate('AdminEvents', { filter: 'pending' })}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={[styles.quickBtnGrad, styles.quickBtnSecondary]}>
                <Ionicons name="checkmark-done" size={22} color={colors.secondary} style={styles.quickBtnIcon} />
                <Text style={[styles.quickBtnText, { color: colors.text }]}>{t('admin_pending_btn')}</Text>
                {(stats?.pendingEvents ?? 0) > 0 && (
                  <View style={styles.quickBtnBadge}>
                    <Text style={styles.quickBtnBadgeText}>{stats.pendingEvents}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={handleSync}
              disabled={syncing}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ busy: syncing }}
            >
              <View style={[styles.quickBtnGrad, styles.quickBtnSecondary]}>
                {syncing ? (
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginBottom: 6 }} />
                ) : (
                  <Ionicons name="sync" size={22} color={colors.accent} style={styles.quickBtnIcon} />
                )}
                <Text style={[styles.quickBtnText, { color: colors.text }]}>
                  {syncing ? t('admin_syncing') : t('admin_sync_btn')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* GÖRSEL/TÜR ZENGİNLEŞTİRME */}
          <TouchableOpacity
            style={styles.enrichBtn}
            onPress={handleEnrich}
            disabled={enriching}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ busy: enriching }}
          >
            <View style={[styles.quickBtnGrad, styles.quickBtnSecondary]}>
              {enriching ? (
                <ActivityIndicator size="small" color={colors.purple} style={{ marginBottom: 6 }} />
              ) : (
                <Ionicons name="color-palette" size={22} color={colors.purple} style={styles.quickBtnIcon} />
              )}
              <Text style={[styles.quickBtnText, { color: colors.text }]}>
                {enriching ? t('admin_enriching') : t('admin_enrich_btn')}
              </Text>
            </View>
          </TouchableOpacity>

          {/* TEST: ŞEHRİMDE SAHTE KONSER */}
          <TouchableOpacity
            style={styles.enrichBtn}
            onPress={handleCreateTestConcert}
            disabled={creatingConcert}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ busy: creatingConcert }}
          >
            <View style={[styles.quickBtnGrad, styles.quickBtnSecondary]}>
              {creatingConcert ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ marginBottom: 6 }} />
              ) : (
                <Ionicons name="mic" size={22} color={colors.accent} style={styles.quickBtnIcon} />
              )}
              <Text style={[styles.quickBtnText, { color: colors.text }]}>
                {creatingConcert ? t('admin_test_concert_creating') : t('admin_test_concert_btn')}
              </Text>
            </View>
          </TouchableOpacity>

          {/* NAV CARDS */}
          <Text style={styles.sectionTitle}>{t('admin_management')}</Text>
          {NAV_ITEMS.map(item => (
            <TouchableOpacity
              key={item.screen}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.85}
              style={styles.navCard}
              accessibilityRole="button"
              accessibilityLabel={`${t(item.titleKey)}, ${t(item.subtitleKey)}`}
            >
              <View style={styles.navCardGrad}>
                <View style={[styles.navIconWrap, { backgroundColor: (colors[item.tint] || colors.primary) + '22' }]}>
                  <Ionicons name={item.icon} size={24} color={colors[item.tint] || colors.primary} />
                </View>
                <View style={styles.navInfo}>
                  <Text style={styles.navTitle}>{t(item.titleKey)}</Text>
                  <Text style={styles.navSubtitle}>{t(item.subtitleKey)}</Text>
                </View>
                <View style={styles.navRight}>
                  {stats?.[item.badge] > 0 && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{stats[item.badge]} {t(item.badgeLabelKey)}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* SUMMARY ROW */}
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.totalFollows ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{tu('admin_sum_follows')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.totalCommunities ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{tu('admin_sum_communities')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.adminUsers ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{tu('admin_sum_admins')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.approvedEvents ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{tu('admin_sum_approved')}</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // HEADER
    header: { paddingTop: 64, paddingBottom: 28, paddingHorizontal: 24 },
    headerBadge: {
      alignSelf: 'flex-start', backgroundColor: colors.primary + '30',
      borderWidth: 1, borderColor: colors.primary + '60',
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10,
    },
    headerBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
    headerTitle: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -0.5, marginTop: 10 },
    headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    appBtn: {
      marginTop: 16, alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    },
    appBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    errorEmoji: { marginBottom: 16 },
    errorText: { fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 24 },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    sectionTitle: {
      fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
      color: colors.textSecondary,
      marginHorizontal: 20, marginTop: 28, marginBottom: 14,
    },

    // STATS GRID
    statsGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: 16, gap: 12,
    },
    statCard: {
      width: (width - 48) / 2,
      borderRadius: 18, padding: 16,
      alignItems: 'flex-start',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    statIcon: { marginBottom: 8 },
    statValue: { fontSize: 28, fontWeight: '900', color: colors.text, lineHeight: 32 },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 15 },

    // QUICK ACTIONS
    quickActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
    quickBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
    enrichBtn: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden' },
    quickBtnGrad: {
      paddingVertical: 16, paddingHorizontal: 14,
      alignItems: 'center', position: 'relative',
    },
    quickBtnIcon: { marginBottom: 6 },
    quickBtnSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
    quickBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    quickBtnBadge: {
      position: 'absolute', top: 8, right: 8,
      backgroundColor: '#fff', borderRadius: 10,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    quickBtnBadgeText: { fontSize: 11, fontWeight: '800', color: '#E94560' },

    // NAV CARDS
    navCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    navCardGrad: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
    navIconWrap: {
      width: 50, height: 50, borderRadius: 25,
      alignItems: 'center', justifyContent: 'center',
    },
    navInfo: { flex: 1 },
    navTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 3 },
    navSubtitle: { fontSize: 12, color: colors.textSecondary },
    navRight: { alignItems: 'flex-end', gap: 6 },
    navBadge: {
      backgroundColor: colors.primary + '22',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    navBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },

    // SUMMARY
    summaryCard: {
      flexDirection: 'row', margin: 16, marginTop: 28,
      borderRadius: 16, borderWidth: 1, paddingVertical: 16,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNum: { fontSize: 20, fontWeight: '800', color: colors.text },
    summaryLabel: { fontSize: 10, marginTop: 3, letterSpacing: 0.8 },
    summaryDivider: { width: 1, marginVertical: 4 },
  });
}
