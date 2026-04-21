import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView
} from 'react-native';
import API from '../services/api';

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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6C63FF" />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
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
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', alignItems: 'center', padding: 30, paddingTop: 60 },
  avatar: { fontSize: 80, marginBottom: 12 },
  username: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { alignItems: 'center', paddingHorizontal: 30 },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#6C63FF' },
  statLabel: { fontSize: 13, color: '#999', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#eee' },
  logoutButton: { margin: 24, backgroundColor: '#ff4d4d', padding: 16, borderRadius: 10, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});