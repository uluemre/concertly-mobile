import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { formatTimeAgo } from '../utils/time';

const POST_TYPE_CONFIG = {
  TEXT:  { icon: '💬', labelKey: 'admin_type_text', color: '#7C3AED' },
  IMAGE: { icon: '🖼️', labelKey: 'admin_type_image', color: '#3B82F6' },
  POLL:  { icon: '📊', labelKey: 'admin_type_poll', color: '#F5A623' },
};

export default function AdminPostsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchPosts = useCallback(async () => {
    try {
      const res = await API.get('/admin/posts');
      setPosts(res.data);
    } catch (err) {
      console.log('Admin posts error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts.filter(p =>
      p.username?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q) ||
      p.eventName?.toLowerCase().includes(q)
    );
  }, [posts, search]);

  const handleDelete = (post) => {
    Alert.alert(
      t('admin_post_delete_title'),
      `${t('admin_post_delete_msg', { username: post.username })}\n\n"${(post.content || '').substring(0, 80)}${post.content?.length > 80 ? '...' : ''}"`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive', onPress: async () => {
            try {
              await API.delete(`/admin/posts/${post.id}`);
              setPosts(prev => prev.filter(p => p.id !== post.id));
            } catch { Alert.alert(t('error'), t('admin_post_delete_error')); }
          },
        },
      ]
    );
  };

  const renderPost = ({ item }) => {
    const typeConfig = POST_TYPE_CONFIG[item.postType] || POST_TYPE_CONFIG.TEXT;
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* HEADER */}
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: typeConfig.color + '30' }]}>
            <Text style={[styles.avatarText, { color: typeConfig.color }]}>
              {item.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.headerRow}>
              <Text style={[styles.username, { color: colors.text }]}>@{item.username}</Text>
              <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '22' }]}>
                <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>
                  {typeConfig.icon} {t(typeConfig.labelKey)}
                </Text>
              </View>
            </View>
            {item.eventName && (
              <Text style={[styles.eventName, { color: colors.primary }]} numberOfLines={1}>
                🎵 {item.eventName}
              </Text>
            )}
            <Text style={[styles.postTime, { color: colors.textSecondary }]}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
        </View>

        {/* CONTENT */}
        {item.content ? (
          <Text style={[styles.content, { color: colors.text }]} numberOfLines={4}>
            {item.content}
          </Text>
        ) : null}

        {/* FOOTER */}
        <View style={styles.cardFooter}>
          <View style={styles.stats}>
            <Text style={[styles.stat, { color: colors.textSecondary }]}>❤️ {item.likeCount ?? 0}</Text>
            <Text style={[styles.stat, { color: colors.textSecondary }]}>💬 {item.commentCount ?? 0}</Text>
            <Text style={[styles.stat, { color: colors.textSecondary }]}>#{item.id}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={[styles.deleteBtn, { backgroundColor: '#E9456018', borderColor: '#E9456050' }]}
          >
            <Text style={[styles.deleteBtnText, { color: '#E94560' }]}>{t('admin_action_delete')}</Text>
          </TouchableOpacity>
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
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('admin_posts_title')}</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              {t('admin_posts_count', { shown: filtered.length, total: posts.length })}
            </Text>
          </View>
          <View style={[styles.totalBadge, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '50' }]}>
            <Text style={[styles.totalBadgeText, { color: colors.primary }]}>
              📝 {posts.length}
            </Text>
          </View>
        </View>

        {/* SEARCH */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>⌕</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('admin_posts_search')}
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

        {/* TYPE STATS */}
        <View style={styles.typeStats}>
          {Object.entries(POST_TYPE_CONFIG).map(([type, cfg]) => {
            const count = posts.filter(p => p.postType === type).length;
            return (
              <View key={type} style={[styles.typeStat, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}>
                <Text style={styles.typeStatIcon}>{cfg.icon}</Text>
                <Text style={[styles.typeStatNum, { color: cfg.color }]}>{count}</Text>
                <Text style={[styles.typeStatLabel, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderPost}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {search ? t('admin_no_search_results') : t('admin_posts_empty')}
              </Text>
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
    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, gap: 10 },
    backText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 26, fontWeight: '900' },
    headerSub: { fontSize: 12, marginTop: 2 },
    totalBadge: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 12, borderWidth: 1,
    },
    totalBadgeText: { fontSize: 14, fontWeight: '800' },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    },
    searchInput: { flex: 1, fontSize: 14 },
    typeStats: { flexDirection: 'row', gap: 10 },
    typeStat: {
      flex: 1, borderRadius: 12, borderWidth: 1,
      paddingVertical: 8, alignItems: 'center', gap: 2,
    },
    typeStatIcon: { fontSize: 18 },
    typeStatNum: { fontSize: 15, fontWeight: '800' },
    typeStatLabel: { fontSize: 10, fontWeight: '700' },

    // CARD
    card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '900' },
    headerInfo: { flex: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    username: { fontSize: 14, fontWeight: '800' },
    typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    typeBadgeText: { fontSize: 10, fontWeight: '800' },
    eventName: { fontSize: 12, marginBottom: 2 },
    postTime: { fontSize: 11 },
    content: { fontSize: 14, lineHeight: 20, marginBottom: 12, opacity: 0.85 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stats: { flexDirection: 'row', gap: 14 },
    stat: { fontSize: 12, fontWeight: '600' },
    deleteBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
    deleteBtnText: { fontSize: 13, fontWeight: '800' },

    empty: { alignItems: 'center', paddingVertical: 80 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 15 },
  });
}
