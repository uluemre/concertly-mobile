import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import API from '../services/api';

const { width } = Dimensions.get('window');

const STAT_CARDS = [
  { key: 'totalUsers',       label: 'Toplam\nKullanıcı', icon: '👥', gradient: ['#7C3AED', '#5B21B6'] },
  { key: 'activeUsers',      label: 'Aktif\nKullanıcı',  icon: '✅', gradient: ['#00D4AA', '#059669'] },
  { key: 'bannedUsers',      label: 'Banlı\nKullanıcı',  icon: '🚫', gradient: ['#E94560', '#BE123C'] },
  { key: 'newUsersThisWeek', label: 'Bu Hafta\nYeni',    icon: '🌱', gradient: ['#3B82F6', '#1D4ED8'] },
  { key: 'totalEvents',      label: 'Toplam\nEtkinlik',  icon: '🎵', gradient: ['#F5A623', '#D97706'] },
  { key: 'pendingEvents',    label: 'Onay\nBekleyen',    icon: '⏳', gradient: ['#EC4899', '#BE185D'] },
  { key: 'totalPosts',       label: 'Toplam\nPost',      icon: '📝', gradient: ['#8B5CF6', '#6D28D9'] },
  { key: 'totalAttendance',  label: 'Katılım\nKayıt',    icon: '🎟️', gradient: ['#06B6D4', '#0E7490'] },
];

const NAV_ITEMS = [
  {
    title: 'Etkinlik Yönetimi',
    subtitle: 'Ekle, düzenle, onayla, sil',
    icon: '🎵',
    screen: 'AdminEvents',
    gradient: ['#E94560', '#7C3AED'],
    badge: 'pendingEvents',
    badgeLabel: 'bekleyen',
  },
  {
    title: 'Kullanıcı Yönetimi',
    subtitle: 'Listele, banla, admin yap',
    icon: '👥',
    screen: 'AdminUsers',
    gradient: ['#00D4AA', '#3B82F6'],
    badge: 'bannedUsers',
    badgeLabel: 'banlı',
  },
  {
    title: 'Post Yönetimi',
    subtitle: 'Tüm postları görüntüle, sil',
    icon: '📝',
    screen: 'AdminPosts',
    gradient: ['#F5A623', '#E94560'],
    badge: 'totalPosts',
    badgeLabel: 'post',
  },
];

export default function AdminScreen({ navigation }) {
  const { colors } = useTheme();
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
        setError('Bu sayfaya erişim yetkiniz yok.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Sunucuya bağlanılamadı.');
      } else {
        setError('İstatistikler yüklenemedi.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
        <Text style={styles.headerTitle}>Yönetim Paneli</Text>
        <Text style={styles.headerSub}>Concertly · Sistem kontrolü</Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('MainApp')}
          style={styles.appBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.appBtnText}>📱 Uygulamaya Dön</Text>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity onPress={fetchStats} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.retryBtnText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* STAT GRID */}
          <Text style={styles.sectionTitle}>GENEL BAKIŞ</Text>
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
                <Text style={styles.statLabel}>{card.label}</Text>
              </LinearGradient>
            ))}
          </View>

          {/* QUICK ACTIONS */}
          <Text style={styles.sectionTitle}>HIZLI İŞLEMLER</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => navigation.navigate('AdminEvents', { openCreate: true })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.quickBtnGrad}>
                <Text style={styles.quickBtnIcon}>➕</Text>
                <Text style={styles.quickBtnText}>Etkinlik Ekle</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => navigation.navigate('AdminEvents', { filter: 'pending' })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#F5A623', '#E94560']} style={styles.quickBtnGrad}>
                <Text style={styles.quickBtnIcon}>✅</Text>
                <Text style={styles.quickBtnText}>Bekleyenler</Text>
                {(stats?.pendingEvents ?? 0) > 0 && (
                  <View style={styles.quickBtnBadge}>
                    <Text style={styles.quickBtnBadgeText}>{stats.pendingEvents}</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* NAV CARDS */}
          <Text style={styles.sectionTitle}>YÖNETİM</Text>
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
                  <Text style={styles.navTitle}>{item.title}</Text>
                  <Text style={styles.navSubtitle}>{item.subtitle}</Text>
                </View>
                <View style={styles.navRight}>
                  {stats?.[item.badge] > 0 && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{stats[item.badge]} {item.badgeLabel}</Text>
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
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Takip</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.totalCommunities ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Topluluk</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.adminUsers ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Admin</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{stats?.approvedEvents ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Onaylı</Text>
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
