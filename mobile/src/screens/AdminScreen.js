import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import API from '../services/api';

function StatCard({ label, value, gradient, styles }) {
  return (
    <LinearGradient colors={gradient} style={styles.statCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Text style={styles.statValue}>{value ?? '-'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </LinearGradient>
  );
}

function NavCard({ title, subtitle, emoji, onPress, styles, colors }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.navCard} activeOpacity={0.8}>
      <View style={[styles.navCardInner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.navEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.navTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.navSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <Text style={[styles.navArrow, { color: colors.primary }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AdminScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await API.get('/admin/stats');
      setStats(res.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStats(); }} tintColor={colors.primary} />}
    >
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Paneli</Text>
        <Text style={styles.headerSub}>Uygulama yönetim merkezi</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GENEL BAKIS</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Kullanici" value={stats?.totalUsers} gradient={['#7C3AED', '#E94560']} styles={styles} />
            <StatCard label="Etkinlik" value={stats?.totalEvents} gradient={['#00D4AA', '#7C3AED']} styles={styles} />
            <StatCard label="Bekleyen" value={stats?.pendingEvents} gradient={['#F5A623', '#E94560']} styles={styles} />
            <StatCard label="Katilim" value={stats?.totalAttendance} gradient={['#00A8FF', '#00D4AA']} styles={styles} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>YONETIM</Text>
          <NavCard
            title="Etkinlik Yonetimi"
            subtitle="Ekle, duzenle, onayla, sil"
            emoji="🎵"
            onPress={() => navigation.navigate('AdminEvents')}
            styles={styles}
            colors={colors}
          />
          <NavCard
            title="Kullanici Yonetimi"
            subtitle="Listele, banla, admin yap"
            emoji="👥"
            onPress={() => navigation.navigate('AdminUsers')}
            styles={styles}
            colors={colors}
          />
        </>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24 },
    backBtn: { marginBottom: 12 },
    backText: { fontSize: 16 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text },
    headerSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

    sectionTitle: {
      fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
      marginHorizontal: 20, marginTop: 24, marginBottom: 12,
    },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
    statCard: {
      width: '46%', borderRadius: 16, padding: 18,
      alignItems: 'center',
    },
    statValue: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

    navCard: { marginHorizontal: 16, marginBottom: 10 },
    navCardInner: {
      flexDirection: 'row', alignItems: 'center',
      padding: 16, borderRadius: 14, borderWidth: 1, gap: 14,
    },
    navEmoji: { fontSize: 28 },
    navTitle: { fontSize: 16, fontWeight: '600' },
    navSubtitle: { fontSize: 12, marginTop: 2 },
    navArrow: { fontSize: 24, fontWeight: '300' },
  });
}
