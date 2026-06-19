import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Animated,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API, { getErrorMessage } from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PostCard from '../components/feed/PostCard';
import AnimatedListItem from '../components/AnimatedListItem';

const PAGE_SIZE = 20;

export default function FeedScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('following');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const tabIndicator = useRef(new Animated.Value(1)).current;
  const isMounted = useRef(true);
  const autoSwitchedRef = useRef(false);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // Tek sayfa yükle (reset=baştan, değilse sıradaki sayfayı ekle). Sunucu createdAt'e
  // göre sıralı döndürüyor; istemci sıralamasına gerek yok.
  const loadFeed = useCallback(async ({ reset, tab }) => {
    const activeT = tab || activeTab;
    const page = reset ? 0 : pageRef.current;
    try {
      const base = activeT === 'trending'
        ? '/posts/feed/trending'
        : `/posts/feed/following?userId=${session.userId}`;
      const sep = base.includes('?') ? '&' : '?';
      const res = await API.get(`${base}${sep}page=${page}&size=${PAGE_SIZE}`);
      if (!isMounted.current) return { switched: false };
      const data = res.data || [];

      // 5.2: takip akışı ilk sayfada boşsa bir kez otomatik trending'e geç
      if (reset && activeT === 'following' && data.length === 0 && !autoSwitchedRef.current) {
        autoSwitchedRef.current = true;
        switchTab('trending');
        return { switched: true };
      }

      setPosts(prev => reset ? data : [...prev, ...data]);
      setError(null);
      pageRef.current = page + 1;
      hasMoreRef.current = data.length === PAGE_SIZE;
    } catch (err) {
      if (isMounted.current) setError(getErrorMessage(err));
    }
    return { switched: false };
  }, [activeTab, session.userId]);

  // Sekme değişince baştan yükle
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pageRef.current = 0;
    hasMoreRef.current = true;
    (async () => {
      const r = await loadFeed({ reset: true, tab: activeTab });
      if (!cancelled && !r.switched && isMounted.current) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    pageRef.current = 0;
    hasMoreRef.current = true;
    await loadFeed({ reset: true });
    if (isMounted.current) setRefreshing(false);
  }, [loadFeed]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMoreRef.current || loading || error) return;
    setLoadingMore(true);
    await loadFeed({ reset: false });
    if (isMounted.current) setLoadingMore(false);
  }, [loadFeed, loadingMore, loading, error]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setLoading(true);
    Animated.spring(tabIndicator, {
      toValue: tab === 'trending' ? 0 : 1,
      tension: 70, friction: 10, useNativeDriver: false,
    }).start();
  };

  const indicatorLeft = tabIndicator.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  const handleDeletePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleEditPost = useCallback((postId, newContent) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent } : p));
  }, []);

  const renderPost = useCallback(({ item, index }) => (
    <AnimatedListItem index={index}>
      <PostCard
        item={item}
        index={index}
        currentUserId={session.userId}
        navigation={navigation}
        onDelete={handleDeletePost}
        onEdit={handleEditPost}
      />
    </AnimatedListItem>
  ), [navigation, session.userId, handleDeletePost, handleEditPost]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <Text style={styles.headerTitle}>{t('feed_title')}</Text>
        <View style={styles.tabBar}>
          <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('trending')}>
            <Text style={[styles.tabBtnText, activeTab === 'trending' && styles.tabBtnTextActive]}>
              {t('feed_trending')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('following')}>
            <Text style={[styles.tabBtnText, activeTab === 'following' && styles.tabBtnTextActive]}>
              {t('feed_following')}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('feed_loading')}</Text>
        </View>
      ) : (error && posts.length === 0) ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📡</Text>
          <Text style={styles.emptyTitle}>{t('load_failed')}</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setError(null); setLoading(true);
              pageRef.current = 0; hasMoreRef.current = true;
              loadFeed({ reset: true }).then(() => isMounted.current && setLoading(false));
            }}
            activeOpacity={0.85}
            style={styles.emptyCtaWrap}
          >
            <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.emptyCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.emptyCtaText}>{t('retry')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id.toString()}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={11}
          removeClippedSubviews
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{activeTab === 'following' ? '👥' : '📭'}</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'following' ? t('feed_empty_following_title') : t('feed_empty_title')}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'following' ? t('feed_empty_following_sub') : t('feed_empty_sub')}
              </Text>
              <TouchableOpacity
                onPress={() => activeTab === 'following' ? switchTab('trending') : navigation.navigate('MainApp', { screen: 'Events' })}
                activeOpacity={0.85}
                style={styles.emptyCtaWrap}
              >
                <LinearGradient
                  colors={['#E94560', '#7C3AED']}
                  style={styles.emptyCta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.emptyCtaText}>
                    {activeTab === 'following' ? t('feed_empty_following_cta') : t('feed_empty_cta')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Genel paylaşım — etkinliğe bağlı olmayan serbest post */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#E94560', '#7C3AED']}
          style={styles.fabInner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.fabIcon}>✏️</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
    headerTitle: {
      fontSize: 26, fontWeight: 'bold', color: colors.text,
      marginBottom: 16, letterSpacing: -0.5,
    },
    tabBar: {
      flexDirection: 'row', backgroundColor: colors.cardAlt,
      borderRadius: 14, padding: 4, position: 'relative', overflow: 'hidden',
    },
    tabIndicator: {
      position: 'absolute', top: 4, width: '50%', bottom: 4,
      backgroundColor: colors.primary, borderRadius: 10,
    },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', zIndex: 1 },
    tabBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabBtnTextActive: { color: '#fff' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: colors.textSecondary, fontSize: 14 },
    listContent: { padding: 16, paddingBottom: 32 },
    empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' },
    emptySubtext: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    emptyCtaWrap: { marginTop: 20 },
    emptyCta: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14, alignItems: 'center' },
    emptyCtaText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    fab: {
      position: 'absolute', right: 20, bottom: 24,
      borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.3,
      shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    fabInner: {
      width: 60, height: 60, borderRadius: 30,
      justifyContent: 'center', alignItems: 'center',
    },
    fabIcon: { fontSize: 26 },
  });
}
