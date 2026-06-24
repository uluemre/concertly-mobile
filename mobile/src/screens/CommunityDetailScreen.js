import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Image, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API, { getErrorMessage } from '../services/api';

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
  const [postsLocked, setPostsLocked] = useState(false);
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [acting, setActing] = useState(false);

  // Yorumlar (yanıtlar)
  const [expanded, setExpanded] = useState(null);           // açık olan post id
  const [commentsByPost, setCommentsByPost] = useState({}); // postId -> yorum[]
  const [commentDrafts, setCommentDrafts] = useState({});   // postId -> taslak metin
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const status = community?.currentUserStatus;       // ACTIVE | PENDING | INVITED | null
  const joined = status === 'ACTIVE';

  const fetchData = useCallback(async () => {
    try {
      const commRes = await API.get(`/communities/${communityId}`);
      setCommunity(commRes.data);
      try {
        const postsRes = await API.get(`/communities/${communityId}/posts`);
        setPosts(postsRes.data);
        setPostsLocked(false);
      } catch {
        // Public dışı topluluklarda üye olmayan gönderileri göremez
        setPostsLocked(true);
        setPosts([]);
      }
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

  // Görünürlük + üyelik durumuna göre ana buton davranışı
  const handleJoinPress = async () => {
    if (acting) return;
    setActing(true);
    try {
      if (joined) {
        await API.delete(`/communities/${communityId}/join`);
        await fetchData();
      } else if (status === 'INVITED') {
        const res = await API.post(`/communities/${communityId}/invite/accept`);
        setCommunity(res.data);
        await fetchData();
      } else {
        const res = await API.post(`/communities/${communityId}/join`);
        setCommunity(res.data);
        if (res.data.currentUserStatus === 'PENDING') {
          Alert.alert(t('success'), t('community_request_sent'));
        } else {
          await fetchData();
        }
      }
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setActing(false);
    }
  };

  // Ana buton metni / pasifliği
  const joinButton = (() => {
    if (status === 'PENDING') return { label: t('community_request_pending'), disabled: true, active: true };
    if (status === 'INVITED') return { label: t('communities_join'), disabled: false, active: false };
    if (joined) return { label: t('communities_joined'), disabled: false, active: true };
    if (community?.visibility === 'PRIVATE') return { label: t('community_request_join'), disabled: false, active: false };
    return { label: t('communities_join'), disabled: false, active: false };
  })();

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

  const toggleComments = async (post) => {
    if (expanded === post.id) { setExpanded(null); return; }
    setExpanded(post.id);
    if (!commentsByPost[post.id]) {
      setLoadingComments(true);
      try {
        const res = await API.get(`/communities/${communityId}/posts/${post.id}/comments`);
        setCommentsByPost(prev => ({ ...prev, [post.id]: res.data }));
      } catch (err) {
        Alert.alert(t('error'), getErrorMessage(err));
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const setDraftFor = (postId, text) =>
    setCommentDrafts(prev => ({ ...prev, [postId]: text }));

  const sendComment = async (post) => {
    const content = (commentDrafts[post.id] || '').trim();
    if (!content || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await API.post(`/communities/${communityId}/posts/${post.id}/comments`, { content });
      setCommentsByPost(prev => ({ ...prev, [post.id]: [...(prev[post.id] || []), res.data] }));
      setDraftFor(post.id, '');
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setSendingComment(false);
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

        {community.canManage ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('CommunityManage', { communityId })}
            style={[styles.heroJoinButton, styles.heroJoinButtonActive]}
          >
            <Text style={styles.heroJoinTextActive}>
              {t('community_manage')}
              {community.pendingRequestCount > 0 ? ` (${community.pendingRequestCount})` : ''}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleJoinPress}
            disabled={joinButton.disabled || acting}
            style={[styles.heroJoinButton, joinButton.active && styles.heroJoinButtonActive, (joinButton.disabled || acting) && { opacity: 0.7 }]}
          >
            {acting
              ? <ActivityIndicator color={joinButton.active ? '#fff' : colors.primary} />
              : <Text style={[styles.heroJoinText, joinButton.active && styles.heroJoinTextActive]}>
                  {joinButton.label}
                </Text>}
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* ONAY DURUMU BANNER'I */}
      {community.approvalStatus === 'PENDING' && (
        <View style={[styles.banner, styles.bannerReview]}>
          <Text style={styles.bannerText}>🕒 {t('community_review_banner')}</Text>
        </View>
      )}
      {community.approvalStatus === 'REJECTED' && (
        <View style={[styles.banner, styles.bannerRejected]}>
          <Text style={styles.bannerText}>⚠️ {t('community_rejected_banner')}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('communities_next_event')}</Text>
        <View style={styles.topicCard}>
          <Text style={styles.topicTitle}>{community.nextEvent}</Text>
          <Text style={styles.topicSub}>
            Topluluk bu başlık etrafında aktif. Etkinlik planları, bilet ve buluşma notları burada toplanır.
          </Text>
        </View>
      </View>

      {joined && (
        <View style={styles.section}>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('communities_compose')}
              placeholderTextColor={colors.textSecondary}
              multiline
              style={styles.composerInput}
            />
            <TouchableOpacity
              onPress={publishPost}
              disabled={!draft.trim() || publishing}
              style={[styles.publishButton, (!draft.trim() || publishing) && styles.publishButtonDisabled]}
            >
              <Text style={styles.publishText}>{publishing ? '...' : t('communities_publish')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('communities_feed')}</Text>
        {postsLocked && (
          <Text style={styles.emptyText}>🔒 {t('community_posts_locked')}</Text>
        )}
        {!postsLocked && posts.map(post => {
          const open = expanded === post.id;
          const comments = commentsByPost[post.id] || [];
          return (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Avatar uri={post.userProfileImageUrl} name={post.username} styles={styles} />
                <View style={styles.postHeaderText}>
                  <Text style={styles.username}>@{post.username}</Text>
                  <Text style={styles.postTime}>{formatRelativeTime(post.createdAt)}</Text>
                </View>
              </View>
              <Text style={styles.postContent}>{post.content}</Text>

              <View style={styles.postFooter}>
                <TouchableOpacity onPress={() => toggleLike(post)} style={styles.actionBtn} activeOpacity={0.7}>
                  <Text style={[styles.actionIcon, post.isLikedByCurrentUser && styles.actionIconLiked]}>
                    {post.isLikedByCurrentUser ? '♥' : '♡'}
                  </Text>
                  <Text style={[styles.actionLabel, post.isLikedByCurrentUser && styles.actionLabelLiked]}>
                    {post.likeCount}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleComments(post)} style={styles.actionBtn} activeOpacity={0.7}>
                  <Text style={[styles.actionIcon, open && styles.actionLabelActive]}>💬</Text>
                  <Text style={[styles.actionLabel, open && styles.actionLabelActive]}>
                    {post.commentCount || 0} {t('communities_reply')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* YORUMLAR */}
              {open && (
                <View style={styles.commentsWrap}>
                  {loadingComments && !commentsByPost[post.id] ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
                  ) : (
                    <>
                      {comments.map(c => (
                        <View key={c.id} style={styles.commentRow}>
                          <Avatar uri={c.userProfileImageUrl} name={c.username} styles={styles} small />
                          <View style={styles.commentBubble}>
                            <Text style={styles.commentUser}>@{c.username}</Text>
                            <Text style={styles.commentText}>{c.content}</Text>
                          </View>
                        </View>
                      ))}
                      {comments.length === 0 && (
                        <Text style={styles.commentEmpty}>{t('communities_no_comments')}</Text>
                      )}
                    </>
                  )}

                  {joined && (
                    <View style={styles.commentComposer}>
                      <TextInput
                        value={commentDrafts[post.id] || ''}
                        onChangeText={(txt) => setDraftFor(post.id, txt)}
                        placeholder={t('communities_reply_ph')}
                        placeholderTextColor={colors.textSecondary}
                        style={styles.commentInput}
                        multiline
                      />
                      <TouchableOpacity
                        onPress={() => sendComment(post)}
                        disabled={!(commentDrafts[post.id] || '').trim() || sendingComment}
                        style={[styles.commentSend, (!(commentDrafts[post.id] || '').trim() || sendingComment) && { opacity: 0.4 }]}
                      >
                        <Text style={styles.commentSendText}>➤</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
        {!postsLocked && posts.length === 0 && (
          <Text style={styles.emptyText}>{t('communities_empty')}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function Avatar({ uri, name, styles, small }) {
  const st = small ? styles.avatarSmall : styles.avatar;
  if (uri) return <Image source={{ uri }} style={st} />;
  return (
    <View style={st}>
      <Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 32 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: colors.textSecondary, fontSize: 14 },
    banner: { marginHorizontal: 16, marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1 },
    bannerReview: { backgroundColor: '#F5A62318', borderColor: '#F5A623' },
    bannerRejected: { backgroundColor: '#E9456018', borderColor: '#E94560' },
    bannerText: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
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
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
    },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    avatarSmall: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    avatarText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
    postHeaderText: { flex: 1 },
    username: { color: colors.text, fontSize: 14, fontWeight: '800' },
    postTime: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    postContent: { color: colors.text, fontSize: 14.5, lineHeight: 21 },

    postFooter: {
      flexDirection: 'row', gap: 10, marginTop: 14,
      paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
    },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
      backgroundColor: colors.cardAlt,
    },
    actionIcon: { color: colors.textSecondary, fontSize: 15, fontWeight: '800' },
    actionIconLiked: { color: '#E94560' },
    actionLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    actionLabelLiked: { color: '#E94560' },
    actionLabelActive: { color: colors.primary },

    // YORUMLAR
    commentsWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
    commentRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
    commentBubble: {
      flex: 1, backgroundColor: colors.cardAlt,
      borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9,
    },
    commentUser: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 2 },
    commentText: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
    commentEmpty: { color: colors.textSecondary, fontSize: 12.5, fontStyle: 'italic', paddingVertical: 4 },
    commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 2 },
    commentInput: {
      flex: 1, backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border, borderRadius: 16,
      paddingHorizontal: 14, paddingVertical: 9,
      color: colors.text, fontSize: 13.5, maxHeight: 100,
    },
    commentSend: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    commentSendText: { color: '#fff', fontSize: 15, fontWeight: '900' },

    emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 20 },
  });
}
