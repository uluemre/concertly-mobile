import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

function formatRelativeTime(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMin = Math.floor((now - then) / 60000);

  if (diffMin < 1) return 'şimdi';
  if (diffMin < 60) return diffMin + 'dk';
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + 'sa';
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return diffDay + 'g';
  return Math.floor(diffDay / 7) + 'h';
}

export default function CommunityDetailScreen({ route, navigation }) {
  const { communityId } = route.params;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [commRes, postsRes] = await Promise.all([
        API.get(`/communities/${communityId}`),
        API.get(`/communities/${communityId}/posts`),
      ]);
      setCommunity(commRes.data);
      setJoined(commRes.data.isJoinedByCurrentUser);
      setPosts(postsRes.data);
    } catch (err) {
      console.error('Community detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const toggleJoin = async () => {
    try {
      if (joined) {
        await API.delete(`/communities/${communityId}/join`);
      } else {
        await API.post(`/communities/${communityId}/join`);
      }
      const newJoined = !joined;
      setJoined(newJoined);
      setCommunity(prev => prev ? {
        ...prev,
        isJoinedByCurrentUser: newJoined,
        memberCount: prev.memberCount + (newJoined ? 1 : -1),
      } : prev);
    } catch (err) {
      console.error('Join toggle error:', err);
    }
  };

  const publishPost = async () => {
    const content = draft.trim();
    if (!content) return;
    setPublishing(true);
    try {
      const res = await API.post(`/communities/${communityId}/posts`, { content });
      setPosts(prev => [res.data, ...prev]);
      setDraft('');
      setCommunity(prev => prev ? { ...prev, postCount: prev.postCount + 1 } : prev);
    } catch (err) {
      console.error('Publish post error:', err);
    } finally {
      setPublishing(false);
    }
  };

  const toggleLike = async (post) => {
    try {
      if (post.isLikedByCurrentUser) {
        await API.delete(`/communities/${communityId}/posts/${post.id}/like`);
      } else {
        await API.post(`/communities/${communityId}/posts/${post.id}/like`);
      }
      setPosts(prev => prev.map(p =>
        p.id === post.id
          ? {
              ...p,
              likeCount: p.likeCount + (post.isLikedByCurrentUser ? -1 : 1),
              isLikedByCurrentUser: !post.isLikedByCurrentUser,
            }
          : p
      ));
    } catch (err) {
      console.error('Like toggle error:', err);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>{t('communities_load_error')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient
        colors={[community.gradientStart, community.gradientEnd]}
        style={styles.hero}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.heroEmoji}>{community.emoji}</Text>
        <Text style={styles.heroTitle}>{community.name}</Text>
        <Text style={styles.heroSub}>{community.description}</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{community.memberCount.toLocaleString('tr-TR')}</Text>
            <Text style={styles.heroStatLabel}>{t('communities_stat_members')}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{community.postCount}</Text>
            <Text style={styles.heroStatLabel}>{t('communities_stat_posts')}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{community.city}</Text>
            <Text style={styles.heroStatLabel}>{t('communities_stat_region')}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={toggleJoin}
          style={[styles.heroJoinButton, joined && styles.heroJoinButtonActive]}
        >
          <Text style={[styles.heroJoinText, joined && styles.heroJoinTextActive]}>
            {joined ? t('communities_joined') : t('communities_join')}
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('communities_next_event')}</Text>
        <View style={styles.topicCard}>
          <Text style={styles.topicTitle}>{community.nextEvent}</Text>
          <Text style={styles.topicSub}>
            Topluluk bu başlık etrafında aktif. Etkinlik planları, bilet ve buluşma notları burada toplanır.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={joined ? t('communities_compose') : t('communities_compose_locked')}
            placeholderTextColor={colors.textSecondary}
            editable={joined}
            multiline
            style={styles.composerInput}
          />
          <TouchableOpacity
            onPress={publishPost}
            disabled={!joined || !draft.trim() || publishing}
            style={[styles.publishButton, (!joined || !draft.trim() || publishing) && styles.publishButtonDisabled]}
          >
            <Text style={styles.publishText}>{publishing ? '...' : t('communities_publish')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('communities_feed')}</Text>
        {posts.map(post => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              {post.userProfileImageUrl ? (
                <Image source={{ uri: post.userProfileImageUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(post.username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.postHeaderText}>
                <Text style={styles.username}>@{post.username}</Text>
                <Text style={styles.postTime}>{formatRelativeTime(post.createdAt)}</Text>
              </View>
            </View>
            <Text style={styles.postContent}>{post.content}</Text>
            <View style={styles.postFooter}>
              <TouchableOpacity onPress={() => toggleLike(post)}>
                <Text style={[styles.postAction, post.isLikedByCurrentUser && styles.postActionLiked]}>
                  ♥ {post.likeCount}
                </Text>
              </TouchableOpacity>
              <Text style={styles.postAction}>{t('communities_reply')}</Text>
            </View>
          </View>
        ))}
        {posts.length === 0 && (
          <Text style={styles.emptyText}>{t('communities_empty')}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 32 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: colors.textSecondary, fontSize: 14 },
    hero: {
      paddingTop: 56,
      paddingBottom: 28,
      paddingHorizontal: 22,
      alignItems: 'center',
    },
    backButton: { alignSelf: 'flex-start', marginBottom: 12 },
    backText: { color: colors.text, fontSize: 14, fontWeight: '800' },
    heroEmoji: { fontSize: 54, marginBottom: 10 },
    heroTitle: { color: colors.text, fontSize: 25, fontWeight: 'bold', textAlign: 'center' },
    heroSub: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 8,
    },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 16,
      paddingVertical: 13,
      paddingHorizontal: 16,
      marginTop: 18,
      gap: 14,
    },
    heroStat: { alignItems: 'center' },
    heroStatNumber: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    heroStatLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 3 },
    heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.24)' },
    heroJoinButton: {
      marginTop: 18,
      backgroundColor: colors.card,
      borderRadius: 15,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    heroJoinButtonActive: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
    heroJoinText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
    heroJoinTextActive: { color: '#fff' },
    section: { paddingHorizontal: 16, marginTop: 16 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
    topicCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
    },
    topicTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 },
    topicSub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    composer: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
    },
    composerInput: {
      minHeight: 72,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    publishButton: {
      alignSelf: 'flex-end',
      marginTop: 10,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 16,
    },
    publishButtonDisabled: { opacity: 0.45 },
    publishText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    postCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 15,
      marginBottom: 11,
    },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    avatarText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
    postHeaderText: { flex: 1 },
    username: { color: colors.text, fontSize: 13, fontWeight: '800' },
    postTime: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    postContent: { color: colors.text, fontSize: 14, lineHeight: 20 },
    postFooter: { flexDirection: 'row', gap: 14, marginTop: 12 },
    postAction: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    postActionLiked: { color: colors.primary },
    emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 20 },
  });
}
