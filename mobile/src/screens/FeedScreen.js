import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Animated,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PostCard from '../components/feed/PostCard';
import AnimatedListItem from '../components/AnimatedListItem';

export default function FeedScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('trending');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tabIndicator = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      try {
        const url = activeTab === 'trending'
          ? '/posts/feed/trending'
          : `/posts/feed/following?userId=${session.userId}`;
        const res = await API.get(url);
        if (!cancelled) setPosts(res.data);
      } catch (err) {
        if (!cancelled) console.log('Feed hatası:', err.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    doFetch();
    return () => { cancelled = true; };
  }, [activeTab]);

  const fetchPosts = useCallback(async () => {
    setRefreshing(true);
    try {
      const url = activeTab === 'trending'
        ? '/posts/feed/trending'
        : `/posts/feed/following?userId=${session.userId}`;
      const res = await API.get(url);
      if (isMounted.current) setPosts(res.data);
    } catch (err) {
      if (isMounted.current) console.log('Feed hatası:', err.message);
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, [activeTab]);

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
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id.toString()}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchPosts} tintColor={colors.primary} />
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
            </View>
          }
        />
      )}
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
  });
}
