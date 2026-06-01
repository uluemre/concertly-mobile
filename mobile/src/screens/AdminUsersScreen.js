import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import API from '../services/api';

const FILTERS = [
  { key: 'all',    label: 'Tümü' },
  { key: 'active', label: '✅ Aktif' },
  { key: 'banned', label: '🚫 Banlı' },
  { key: 'admin',  label: '⚡ Admin' },
];

export default function AdminUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await API.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.log('Admin users error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (activeFilter === 'active') list = list.filter(u => u.isActive !== false);
    else if (activeFilter === 'banned') list = list.filter(u => u.isActive === false);
    else if (activeFilter === 'admin') list = list.filter(u => u.isAdmin);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.city?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, search, activeFilter]);

  const handleBan = (user) => {
    const isBanned = user.isActive === false;
    const action = isBanned ? 'ban kaldırmak' : 'banlamak';
    Alert.alert('Emin misin?', `@${user.username} kullanıcısını ${action} istiyorsun.`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: isBanned ? 'Aktif Et' : 'Banla',
        style: isBanned ? 'default' : 'destructive',
        onPress: async () => {
          try {
            const ep = isBanned ? `/admin/users/${user.id}/unban` : `/admin/users/${user.id}/ban`;
            await API.patch(ep);
            fetchUsers();
          } catch { Alert.alert('Hata', 'İşlem başarısız.'); }
        },
      },
    ]);
  };

  const handleMakeAdmin = (user) => {
    Alert.alert('Admin Yap', `@${user.username} kullanıcısını admin yapmak istiyorsun.`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Admin Yap', onPress: async () => {
          try {
            await API.patch(`/admin/users/${user.id}/make-admin`);
            fetchUsers();
          } catch { Alert.alert('Hata', 'İşlem başarısız.'); }
        },
      },
    ]);
  };

  const handleRemoveAdmin = (user) => {
    Alert.alert('Admin Rolünü Kaldır', `@${user.username} kullanıcısının admin yetkisi kaldırılsın mı?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kaldır', style: 'destructive', onPress: async () => {
          try {
            await API.patch(`/admin/users/${user.id}/remove-admin`);
            fetchUsers();
          } catch { Alert.alert('Hata', 'İşlem başarısız.'); }
        },
      },
    ]);
  };

  const renderUser = ({ item }) => {
    const isBanned = item.isActive === false;
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Sol renkli şerit */}
        <View style={[styles.cardStrip, {
          backgroundColor: item.isAdmin ? '#7C3AED' : isBanned ? '#E94560' : '#00D4AA',
        }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            {/* Avatar */}
            <LinearGradient
              colors={item.isAdmin ? ['#7C3AED', '#5B21B6'] : isBanned ? ['#E94560', '#BE123C'] : ['#00D4AA', '#059669']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {item.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            </LinearGradient>

            {/* Bilgiler */}
            <View style={styles.userInfo}>
              <View style={styles.usernameRow}>
                <Text style={[styles.username, { color: colors.text }]}>@{item.username}</Text>
                <View style={styles.badges}>
                  {item.isAdmin && (
                    <View style={[styles.badge, { backgroundColor: '#7C3AED22' }]}>
                      <Text style={[styles.badgeText, { color: '#7C3AED' }]}>⚡ Admin</Text>
                    </View>
                  )}
                  <View style={[styles.badge, {
                    backgroundColor: isBanned ? '#E9456022' : '#00D4AA22',
                  }]}>
                    <Text style={[styles.badgeText, { color: isBanned ? '#E94560' : '#00D4AA' }]}>
                      {isBanned ? '🚫 Banlı' : '✅ Aktif'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.email, { color: colors.textSecondary }]}>{item.email}</Text>
              <View style={styles.metaRow}>
                {item.city && <Text style={[styles.meta, { color: colors.textSecondary }]}>📍 {item.city}</Text>}
                {item.postCount != null && (
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>📝 {item.postCount} post</Text>
                )}
              </View>
            </View>
          </View>

          {/* Aksiyonlar */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => handleBan(item)}
              style={[styles.actionBtn, {
                backgroundColor: isBanned ? '#00D4AA18' : '#E9456018',
                borderColor: isBanned ? '#00D4AA50' : '#E9456050',
              }]}
            >
              <Text style={[styles.actionBtnText, { color: isBanned ? '#00D4AA' : '#E94560' }]}>
                {isBanned ? '✅ Aktif Et' : '🚫 Banla'}
              </Text>
            </TouchableOpacity>
            {item.isAdmin ? (
              <TouchableOpacity
                onPress={() => handleRemoveAdmin(item)}
                style={[styles.actionBtn, { backgroundColor: '#7C3AED18', borderColor: '#7C3AED50' }]}
              >
                <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>⚡ Admin Kaldır</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleMakeAdmin(item)}
                style={[styles.actionBtn, { backgroundColor: '#7C3AED18', borderColor: '#7C3AED50' }]}
              >
                <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>⚡ Admin Yap</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kullanıcılar</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
          {filtered.length} / {users.length} kullanıcı
        </Text>

        {/* SEARCH */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>⌕</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Kullanıcı, email, şehir ara..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* FILTERS */}
      <View style={[styles.filtersWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={[
              styles.filterBtn,
              activeFilter === f.key && { backgroundColor: colors.primary + '22', borderColor: colors.primary },
            ]}
          >
            <Text style={[
              styles.filterBtnText,
              { color: activeFilter === f.key ? colors.primary : colors.textSecondary },
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Kullanıcı bulunamadı</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, gap: 8 },
    backText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    headerTitle: { fontSize: 26, fontWeight: '900' },
    headerSub: { fontSize: 12 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 11, marginTop: 4,
    },
    searchInput: { flex: 1, fontSize: 14 },

    filtersWrap: {
      flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10,
      gap: 8, borderBottomWidth: 1,
    },
    filterBtn: {
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1, borderColor: 'transparent',
    },
    filterBtnText: { fontSize: 12, fontWeight: '700' },

    // CARD
    card: {
      flexDirection: 'row', borderRadius: 16, borderWidth: 1,
      marginBottom: 12, overflow: 'hidden',
    },
    cardStrip: { width: 4 },
    cardBody: { flex: 1, padding: 14 },
    cardTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { color: '#fff', fontWeight: '900', fontSize: 20 },
    userInfo: { flex: 1 },
    usernameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    username: { fontSize: 15, fontWeight: '800' },
    badges: { flexDirection: 'row', gap: 5 },
    badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: '800' },
    email: { fontSize: 12, marginBottom: 4 },
    metaRow: { flexDirection: 'row', gap: 12 },
    meta: { fontSize: 11 },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
    actionBtnText: { fontSize: 12, fontWeight: '700' },

    empty: { alignItems: 'center', paddingVertical: 80 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 15 },
  });
}
