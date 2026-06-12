import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

const FILTERS = [
  { key: 'all',    labelKey: 'admin_filter_all' },
  { key: 'active', labelKey: 'admin_filter_active' },
  { key: 'banned', labelKey: 'admin_filter_banned' },
  { key: 'admin',  labelKey: 'admin_filter_admin' },
];

export default function AdminUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
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
    const msg = isBanned ? t('admin_unban_msg', { username: user.username }) : t('admin_ban_msg', { username: user.username });
    Alert.alert(t('admin_confirm_title'), msg, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: isBanned ? t('admin_unban_btn') : t('admin_ban_btn'),
        style: isBanned ? 'default' : 'destructive',
        onPress: async () => {
          try {
            const ep = isBanned ? `/admin/users/${user.id}/unban` : `/admin/users/${user.id}/ban`;
            await API.patch(ep);
            fetchUsers();
          } catch { Alert.alert(t('error'), t('admin_op_failed')); }
        },
      },
    ]);
  };

  const handleMakeAdmin = (user) => {
    Alert.alert(t('admin_make_admin_title'), t('admin_make_admin_msg', { username: user.username }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('admin_make_admin_title'), onPress: async () => {
          try {
            await API.patch(`/admin/users/${user.id}/make-admin`);
            fetchUsers();
          } catch { Alert.alert(t('error'), t('admin_op_failed')); }
        },
      },
    ]);
  };

  const handleRemoveAdmin = (user) => {
    Alert.alert(t('admin_remove_admin_title'), t('admin_remove_admin_msg', { username: user.username }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('admin_remove_btn'), style: 'destructive', onPress: async () => {
          try {
            await API.patch(`/admin/users/${user.id}/remove-admin`);
            fetchUsers();
          } catch { Alert.alert(t('error'), t('admin_op_failed')); }
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
                      <Text style={[styles.badgeText, { color: '#7C3AED' }]}>{t('admin_badge_admin')}</Text>
                    </View>
                  )}
                  <View style={[styles.badge, {
                    backgroundColor: isBanned ? '#E9456022' : '#00D4AA22',
                  }]}>
                    <Text style={[styles.badgeText, { color: isBanned ? '#E94560' : '#00D4AA' }]}>
                      {isBanned ? t('admin_status_banned') : t('admin_status_active')}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.email, { color: colors.textSecondary }]}>{item.email}</Text>
              <View style={styles.metaRow}>
                {item.city && <Text style={[styles.meta, { color: colors.textSecondary }]}>📍 {item.city}</Text>}
                {item.postCount != null && (
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{t('admin_post_count', { count: item.postCount })}</Text>
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
                {isBanned ? t('admin_action_unban') : t('admin_action_ban')}
              </Text>
            </TouchableOpacity>
            {item.isAdmin ? (
              <TouchableOpacity
                onPress={() => handleRemoveAdmin(item)}
                style={[styles.actionBtn, { backgroundColor: '#7C3AED18', borderColor: '#7C3AED50' }]}
              >
                <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>{t('admin_action_remove_admin')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleMakeAdmin(item)}
                style={[styles.actionBtn, { backgroundColor: '#7C3AED18', borderColor: '#7C3AED50' }]}
              >
                <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>{t('admin_action_make_admin')}</Text>
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
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('admin_users_title')}</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
          {t('admin_users_count', { shown: filtered.length, total: users.length })}
        </Text>

        {/* SEARCH */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>⌕</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('admin_users_search')}
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
              {t(f.labelKey)}
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
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('admin_users_empty')}</Text>
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
