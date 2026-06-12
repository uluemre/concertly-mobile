import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

const { width } = Dimensions.get('window');

const STAT_CARDS = [
  { key: 'totalUsers',       labelKey: 'admin_stat_total_users',    icon: '👥', gradient: ['#7C3AED', '#5B21B6'] },
  { key: 'activeUsers',      labelKey: 'admin_stat_active_users',   icon: '✅', gradient: ['#00D4AA', '#059669'] },
  { key: 'bannedUsers',      labelKey: 'admin_stat_banned_users',   icon: '🚫', gradient: ['#E94560', '#BE123C'] },
  { key: 'newUsersThisWeek', labelKey: 'admin_stat_new_week',       icon: '🌱', gradient: ['#3B82F6', '#1D4ED8'] },
  { key: 'totalEvents',      labelKey: 'admin_stat_total_events',   icon: '🎵', gradient: ['#F5A623', '#D97706'] },
  { key: 'pendingEvents',    labelKey: 'admin_stat_pending_events', icon: '⏳', gradient: ['#EC4899', '#BE185D'] },
  { key: 'totalPosts',       labelKey: 'admin_stat_total_posts',    icon: '📝', gradient: ['#8B5CF6', '#6D28D9'] },
  { key: 'totalAttendance',  labelKey: 'admin_stat_attendance',     icon: '🎟️', gradient: ['#06B6D4', '#0E7490'] },
];

const NAV_ITEMS = [
  {
    titleKey: 'admin_nav_events_title',
    subtitleKey: 'admin_nav_events_sub',
    icon: '🎵',
    screen: 'AdminEvents',
    gradient: ['#E94560', '#7C3AED'],
    badge: 'pendingEvents',
    badgeLabelKey: 'admin_badge_pending',
  },
  {
    titleKey: 'admin_nav_users_title',
    subtitleKey: 'admin_nav_users_sub',
    icon: '👥',
    screen: 'AdminUsers',
    gradient: ['#00D4AA', '#3B82F6'],
    badge: 'bannedUsers',
    badgeLabelKey: 'admin_badge_banned',
  },
  {
    titleKey: 'admin_nav_posts_title',
    subtitleKey: 'admin_nav_posts_sub',
    icon: '📝',
    screen: 'AdminPosts',
    gradient: ['#F5A623', '#E94560'],
    badge: 'totalPosts',
    badgeLabelKey: 'admin_badge_posts',
  },
];

export default function AdminScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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
      <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.header}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>⚡ ADMIN</Text>
        </View>
        <Text style={styles.headerTitle}>{t('admin_panel_title')}</Text>
        <Text style={styles.headerSub}>{t('admin_panel_sub')}</Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('MainApp')}
          style={styles.appBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.appBtnText}>{t('admin_back_to_app')}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorEmoji}>⚠️</Text>
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
              <LinearGradient
                key={card.key}
                colors={card.gradient}
                style={styles.statCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.statIcon}>{card.icon}</Text>
                <Text style={styles.statValue}>{stats?.[card.key] ?? 0}</Text>
                <Text style={styles.statLabel}>{t(card.labelKey)}</Text>
              </LinearGradient>
            ))}
          </View>

          {/* QUICK ACTIONS */}
          <Text style={styles.sectionTitle}>{t('admin_quick_actions')}</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => navigation.navigate('AdminEvents', { openCreate: true })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.quickBtnGrad}>
                <Text style={styles.quickBtnIcon}>➕</Text>
                <Text style={styles.quickBtnText}>{t('admin_add_event')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => navigation.navigate('AdminEvents', { filter: 'pending' })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#F5A623', '#E94560']} style={styles.quickBtnGrad}>
                <Text style={styles.quickBtnIcon}>✅</Text>
                <Text style={styles.quickBtnText}>{t('admin_pending_btn')}</Text>
                {(stats?.pendingEvents ?? 0) > 0 && (
                  <View style={styles.quickBtnBadge}>
                    <Text style={styles.quickBtnBadgeText}>{stats.pendingEvents}</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* NAV CARDS */}
          <Text style={styles.sectionTitle}>{t('admin_management')}</Text>
          {NAV_ITEMS.map(item => (
            <TouchableOpacity
              key={item.screen}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.85}
              style={styles.navCard}
            >
              <LinearGradient
                colors={item.gradient}
                style={styles.navCardGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.navIconWrap}>
                  <Text style={styles.navIcon}>{item.icon}</Text>
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
                  <Text style={styles.navArrow}>›</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}

          {/* SUMMARY ROW */}
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.totalFollows ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('admin_sum_follows')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.totalCommunities ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('admin_sum_communities')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.adminUsers ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('admin_sum_admins')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.approvedEvents ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('admin_sum_approved')}</Text>
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
    appBtn: {
      marginTop: 16, alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    },
    appBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    errorEmoji: { fontSize: 48, marginBottom: 16 },
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
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
    },
    statIcon: { fontSize: 24, marginBottom: 8 },
    statValue: { fontSize: 28, fontWeight: '900', color: '#fff', lineHeight: 32 },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 15 },

    // QUICK ACTIONS
    quickActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
    quickBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
    quickBtnGrad: {
      paddingVertical: 16, paddingHorizontal: 14,
      alignItems: 'center', position: 'relative',
    },
    quickBtnIcon: { fontSize: 22, marginBottom: 6 },
    quickBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    quickBtnBadge: {
      position: 'absolute', top: 8, right: 8,
      backgroundColor: '#fff', borderRadius: 10,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    quickBtnBadgeText: { fontSize: 11, fontWeight: '800', color: '#E94560' },

    // NAV CARDS
    navCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, overflow: 'hidden' },
    navCardGrad: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
    navIconWrap: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center',
    },
    navIcon: { fontSize: 24 },
    navInfo: { flex: 1 },
    navTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 3 },
    navSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    navRight: { alignItems: 'flex-end', gap: 6 },
    navBadge: {
      backgroundColor: 'rgba(255,255,255,0.25)',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    navBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    navArrow: { color: 'rgba(255,255,255,0.8)', fontSize: 26, fontWeight: '300' },

    // SUMMARY
    summaryCard: {
      flexDirection: 'row', margin: 16, marginTop: 28,
      borderRadius: 16, borderWidth: 1, paddingVertical: 16,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNum: { fontSize: 20, fontWeight: '800', color: colors.text },
    summaryLabel: { fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.8 },
    summaryDivider: { width: 1, marginVertical: 4 },
  });
}
