import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import API from '../services/api';

export default function AdminUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await API.get('/admin/users');
      setUsers(res.data);
      setFiltered(res.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(users.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q)
    ));
  }, [search, users]);

  const handleBan = (user) => {
    const action = user.isActive ? 'banlamak' : 'ban kaldirmak';
    Alert.alert('Emin misin?', `${user.username} kullanicisini ${action} istiyor musun?`, [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Evet', style: 'destructive', onPress: async () => {
          try {
            const endpoint = user.isActive ? `/admin/users/${user.id}/ban` : `/admin/users/${user.id}/unban`;
            await API.patch(endpoint);
            fetchUsers();
          } catch { Alert.alert('Hata', 'Islem basarisiz.'); }
        },
      },
    ]);
  };

  const handleMakeAdmin = (user) => {
    Alert.alert('Admin Yap', `${user.username} kullanicisini admin yapmak istiyor musun?`, [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Evet', onPress: async () => {
          try {
            await API.patch(`/admin/users/${user.id}/make-admin`);
            fetchUsers();
          } catch { Alert.alert('Hata', 'Islem basarisiz.'); }
        },
      },
    ]);
  };

  const renderUser = ({ item }) => (
    <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.userInfo}>
        <View style={styles.userRow}>
          <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
          <View style={styles.badges}>
            {item.isAdmin && (
              <View style={[styles.badge, { backgroundColor: '#7C3AED22' }]}>
                <Text style={[styles.badgeText, { color: '#7C3AED' }]}>Admin</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: item.isActive ? '#00D4AA22' : '#E9456022' }]}>
              <Text style={[styles.badgeText, { color: item.isActive ? '#00D4AA' : '#E94560' }]}>
                {item.isActive ? 'Aktif' : 'Banlı'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{item.email}</Text>
        {item.city ? <Text style={[styles.city, { color: colors.textSecondary }]}>{item.city}</Text> : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => handleBan(item)}
          style={[styles.actionBtn, { backgroundColor: item.isActive ? '#E9456022' : '#00D4AA22' }]}
        >
          <Text style={[styles.actionBtnText, { color: item.isActive ? '#E94560' : '#00D4AA' }]}>
            {item.isActive ? 'Banla' : 'Aktif Et'}
          </Text>
        </TouchableOpacity>
        {!item.isAdmin && (
          <TouchableOpacity
            onPress={() => handleMakeAdmin(item)}
            style={[styles.actionBtn, { backgroundColor: '#7C3AED22' }]}
          >
            <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>Admin Yap</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kullanicılar</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{users.length} kullanici</Text>
      </LinearGradient>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Kullanici ara..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>Kullanici bulunamadi.</Text>}
        />
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
    backBtn: { marginBottom: 8 },
    backText: { fontSize: 16 },
    headerTitle: { fontSize: 26, fontWeight: 'bold' },
    headerSub: { fontSize: 13, marginTop: 2 },

    searchWrap: { margin: 16, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
    searchInput: { fontSize: 15 },

    userCard: {
      borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
    },
    userInfo: { marginBottom: 10 },
    userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    username: { fontSize: 15, fontWeight: '600' },
    badges: { flexDirection: 'row', gap: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    email: { fontSize: 12, marginBottom: 2 },
    city: { fontSize: 12 },

    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
    actionBtnText: { fontSize: 12, fontWeight: '700' },

    empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  });
}
