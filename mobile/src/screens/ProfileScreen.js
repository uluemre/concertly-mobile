import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { colors } from '../theme';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!global.userId) return;
    API.get(`/users/${global.userId}/profile`)
      .then(res => setProfile(res.data))
      .catch(err => console.log('Profil hatası:', err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    global.authToken = null;
    global.userId = null;
    navigation.replace('Login');
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#7C3AED', '#E94560']} style={styles.hero}>
        <Text style={styles.avatar}>👤</Text>
        <Text style={styles.username}>@{profile?.username || 'Kullanıcı'}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile?.followerCount || 0}</Text>
            <Text style={styles.statLabel}>Takipçi</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile?.followingCount || 0}</Text>
            <Text style={styles.statLabel}>Takip</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>

        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>🎵</Text>
            <Text style={styles.menuText}>Gidilen Etkinlikler</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>❤️</Text>
            <Text style={styles.menuText}>Beğenilen Postlar</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuText}>Ayarlar</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleLogout}>
          <LinearGradient
            colors={['#E94560', '#7C3AED']}
            style={styles.logoutButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.logoutText}>🚪 Çıkış Yap</Text>
          </LinearGradient>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  hero: {
    paddingTop: 70,
    paddingBottom: 36,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatar: { fontSize: 72, marginBottom: 12 },
  username: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, gap: 24 },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },
  content: { padding: 16, gap: 12 },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuIcon: { fontSize: 20 },
  menuText: { flex: 1, fontSize: 15, color: colors.text },
  menuArrow: { fontSize: 20, color: colors.textSecondary },
  menuDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  logoutButton: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});