import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Image, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API, { getErrorMessage, uploadImage } from '../services/api';

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

  // Paylaşım kutusu: tip + foto + anket
  const [composerType, setComposerType] = useState('TEXT'); // TEXT | IMAGE | POLL
  const [imageUri, setImageUri] = useState(null);
  const [pollOpts, setPollOpts] = useState(['', '']);

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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('post_perm_title'), t('post_perm_msg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setComposerType('IMAGE');
    }
  };

  const selectType = (type) => {
    setComposerType(type);
    if (type !== 'IMAGE') setImageUri(null);
    if (type === 'POLL' && pollOpts.length < 2) setPollOpts(['', '']);
  };

  const setPollOpt = (txt, i) => setPollOpts(prev => prev.map((o, idx) => idx === i ? txt : o));
  const addPollOpt = () => { if (pollOpts.length < 4) setPollOpts(prev => [...prev, '']); };
  const removePollOpt = (i) => { if (pollOpts.length > 2) setPollOpts(prev => prev.filter((_, idx) => idx !== i)); };

  const resetComposer = () => {
    setDraft(''); setComposerType('TEXT'); setImageUri(null); setPollOpts(['', '']);
  };

  const publishPost = async () => {
    const content = draft.trim();
    if (composerType === 'IMAGE' && !imageUri) { Alert.alert(t('error'), t('post_no_image')); return; }
    if (composerType === 'POLL') {
      const filled = pollOpts.filter(o => o.trim());
      if (filled.length < 2) { Alert.alert(t('error'), t('post_poll_min')); return; }
    }
    if (composerType === 'TEXT' && !content) return;

    setPublishing(true);
    try {
      let serverImageUrl;
      if (composerType === 'IMAGE' && imageUri) {
        serverImageUrl = await uploadImage(imageUri);
      }
      const res = await API.post(`/communities/${communityId}/posts`, {
        content,
        postType: composerType,
        imageUrl: serverImageUrl,
        pollOptions: composerType === 'POLL' ? pollOpts.filter(o => o.trim()) : undefined,
      });
      setPosts(prev => [res.data, ...prev]);
      resetComposer();
      setCommunity(prev => prev ? { ...prev, postCount: prev.postCount + 1 } : prev);
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  const votePoll = async (post, optionId) => {
    try {
      const res = await API.post(`/communities/${communityId}/posts/${post.id}/poll/vote`, null, { params: { optionId } });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, pollOptions: res.data } : p));
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <LinearGradient
        colors={[community.gradientStart, community.gradientEnd]}
        style={styles.hero}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ {t('back')}</Text>
        </TouchableOpacity>

        <View style={styles.heroTopRow}>
          <View style={styles.heroEmojiCircle}>
            <Text style={styles.heroEmoji}>{community.emoji}</Text>
          </View>
          <View style={styles.heroTitleCol}>
            <Text style={styles.heroTitle} numberOfLines={2}>{community.name}</Text>
            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>
                  {community.visibility === 'PRIVATE' ? `🔒 ${t('community_visibility_private')}`
                    : community.visibility === 'SECRET' ? `🕵️ ${t('community_visibility_secret')}`
                    : `🌍 ${t('community_visibility_public')}`}
                </Text>
              </View>
              {!!community.type && (
                <View style={styles.heroChip}><Text style={styles.heroChipText}>🎵 {community.type}</Text></View>
              )}
              {!!community.city && (
                <View style={styles.heroChip}><Text style={styles.heroChipText}>📍 {community.city}</Text></View>
              )}
            </View>
          </View>
        </View>

        {!!community.description && (
          <Text style={styles.heroSub}>{community.description}</Text>
        )}

        <View style={styles.heroStats}>
          <Text style={styles.heroStatItem}>
            <Text style={styles.heroStatNumber}>{community.memberCount.toLocaleString('tr-TR')}</Text>
            <Text style={styles.heroStatLabel}>  {t('communities_stat_members')}</Text>
          </Text>
          <Text style={styles.heroStatSep}>•</Text>
          <Text style={styles.heroStatItem}>
            <Text style={styles.heroStatNumber}>{community.postCount}</Text>
            <Text style={styles.heroStatLabel}>  {t('communities_stat_posts')}</Text>
          </Text>
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

      {/* SABİTLENMİŞ KONU */}
      {!!community.nextEvent && (
        <View style={styles.section}>
          <View style={styles.pinnedCard}>
            <LinearGradient
              colors={[community.gradientStart || '#7C3AED', community.gradientEnd || '#E94560']}
              style={styles.pinnedIcon}
            >
              <Text style={styles.pinnedIconText}>📌</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinnedLabel}>{t('communities_next_event')}</Text>
              <Text style={styles.pinnedTitle} numberOfLines={2}>{community.nextEvent}</Text>
            </View>
          </View>
        </View>
      )}

      {/* PAYLAŞIM KUTUSU */}
      {joined && (
        <View style={styles.section}>
          <View style={styles.composer}>
            <View style={styles.composerTop}>
              <LinearGradient
                colors={[community.gradientStart || '#7C3AED', community.gradientEnd || '#E94560']}
                style={styles.composerAvatar}
              >
                <Text style={styles.composerAvatarText}>✏️</Text>
              </LinearGradient>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('communities_compose')}
                placeholderTextColor={colors.textSecondary}
                multiline
                style={styles.composerInput}
              />
            </View>

            {/* Foto önizleme */}
            {composerType === 'IMAGE' && imageUri && (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity onPress={() => { setImageUri(null); setComposerType('TEXT'); }} style={styles.imageRemove}>
                  <Text style={styles.imageRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Anket seçenekleri */}
            {composerType === 'POLL' && (
              <View style={styles.pollEditor}>
                {pollOpts.map((opt, i) => (
                  <View key={i} style={styles.pollOptRow}>
                    <TextInput
                      value={opt}
                      onChangeText={(txt) => setPollOpt(txt, i)}
                      placeholder={`${t('post_poll_option')} ${i + 1}`}
                      placeholderTextColor={colors.textSecondary}
                      style={styles.pollOptInput}
                      maxLength={60}
                    />
                    {pollOpts.length > 2 && (
                      <TouchableOpacity onPress={() => removePollOpt(i)} style={styles.pollOptRemove}>
                        <Text style={styles.pollOptRemoveText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {pollOpts.length < 4 && (
                  <TouchableOpacity onPress={addPollOpt} style={styles.pollAddBtn}>
                    <Text style={styles.pollAddText}>＋ {t('post_poll_add')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.composerBar}>
              <View style={styles.composerTools}>
                <TouchableOpacity onPress={pickImage} style={[styles.toolBtn, composerType === 'IMAGE' && styles.toolBtnActive]}>
                  <Text style={styles.toolIcon}>🖼️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => selectType(composerType === 'POLL' ? 'TEXT' : 'POLL')}
                  style={[styles.toolBtn, composerType === 'POLL' && styles.toolBtnActive]}
                >
                  <Text style={styles.toolIcon}>📊</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={publishPost}
                disabled={publishing}
                activeOpacity={0.9}
                style={[styles.publishButton, publishing && styles.publishButtonDisabled]}
              >
                <Text style={styles.publishText}>{publishing ? '...' : `${t('communities_publish')} ➤`}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>{t('communities_feed')}</Text>
          {!postsLocked && posts.length > 0 && (
            <View style={styles.feedCountPill}>
              <Text style={styles.feedCountText}>{posts.length}</Text>
            </View>
          )}
        </View>
        {postsLocked && (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedEmoji}>🔒</Text>
            <Text style={styles.lockedText}>{t('community_posts_locked')}</Text>
          </View>
        )}
        {!postsLocked && posts.map(post => {
          const open = expanded === post.id;
          const comments = commentsByPost[post.id] || [];
          return (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Avatar uri={post.userProfileImageUrl} name={post.username} styles={styles}
                        gradient={[community.gradientStart, community.gradientEnd]} />
                <View style={styles.postHeaderText}>
                  <Text style={styles.username}>@{post.username}</Text>
                  <Text style={styles.postTime}>{formatRelativeTime(post.createdAt)}</Text>
                </View>
              </View>
              {!!post.content && <Text style={styles.postContent}>{post.content}</Text>}

              {post.imageUrl && (
                <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
              )}

              {post.postType === 'POLL' && post.pollOptions && (
                <Poll post={post} onVote={votePoll} styles={styles} colors={colors} t={t} />
              )}

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
                          <Avatar uri={c.userProfileImageUrl} name={c.username} styles={styles} small
                                  gradient={[community.gradientStart, community.gradientEnd]} />
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>{t('communities_empty')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Poll({ post, onVote, styles, colors, t }) {
  const options = post.pollOptions || [];
  const total = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);
  const hasVoted = options.some(o => o.voted);
  return (
    <View style={styles.pollWrap}>
      {options.map(o => {
        const pct = total > 0 ? Math.round((o.voteCount / total) * 100) : 0;
        return (
          <TouchableOpacity
            key={o.id}
            activeOpacity={0.85}
            onPress={() => onVote(post, o.id)}
            style={[styles.pollBar, o.voted && styles.pollBarVoted]}
          >
            {hasVoted && <View style={[styles.pollFill, { width: `${pct}%` }, o.voted && styles.pollFillVoted]} />}
            <View style={styles.pollBarContent}>
              <Text style={[styles.pollOptText, o.voted && styles.pollOptTextVoted]} numberOfLines={1}>
                {o.voted ? '✓ ' : ''}{o.optionText}
              </Text>
              {hasVoted && <Text style={styles.pollPct}>{pct}%</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.pollTotal}>{t('post_poll_votes', { n: total })}</Text>
    </View>
  );
}

function Avatar({ uri, name, styles, small, gradient }) {
  const st = small ? styles.avatarSmall : styles.avatar;
  if (uri) return <Image source={{ uri }} style={st} />;
  const colors2 = gradient && gradient.length === 2 ? gradient : ['#7C3AED', '#E94560'];
  return (
    <LinearGradient colors={colors2} style={st}>
      <Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </LinearGradient>
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
      paddingTop: 54,
      paddingBottom: 22,
      paddingHorizontal: 20,
    },
    backButton: { alignSelf: 'flex-start', marginBottom: 16 },
    backText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    heroEmojiCircle: {
      width: 64, height: 64, borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroEmoji: { fontSize: 32 },
    heroTitleCol: { flex: 1 },
    heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 27 },
    heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    heroChip: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4,
    },
    heroChipText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    heroSub: {
      color: 'rgba(255,255,255,0.92)',
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: 14,
    },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      gap: 12,
    },
    heroStatItem: { color: '#fff' },
    heroStatNumber: { color: '#fff', fontSize: 16, fontWeight: '900' },
    heroStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: '600' },
    heroStatSep: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
    heroJoinButton: {
      marginTop: 18,
      backgroundColor: '#fff',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    heroJoinButtonActive: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    heroJoinText: { color: '#1a1a1a', fontSize: 15, fontWeight: '900' },
    heroJoinTextActive: { color: '#fff', fontSize: 15, fontWeight: '900' },
    section: { paddingHorizontal: 16, marginTop: 18 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },

    // SABİTLENMİŞ KONU
    pinnedCard: {
      flexDirection: 'row', alignItems: 'center', gap: 13,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 18, padding: 14,
    },
    pinnedIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    pinnedIconText: { fontSize: 20 },
    pinnedLabel: {
      color: colors.textSecondary, fontSize: 11, fontWeight: '800',
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3,
    },
    pinnedTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },

    // PAYLAŞIM KUTUSU
    composer: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 14,
    },
    composerTop: { flexDirection: 'row', gap: 11 },
    composerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    composerAvatarText: { fontSize: 17 },
    composerInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 140,
      color: colors.text,
      fontSize: 14.5,
      lineHeight: 20,
      textAlignVertical: 'top',
      paddingTop: 8,
    },
    composerBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 12,
    },
    composerTools: { flexDirection: 'row', gap: 8 },
    toolBtn: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    toolBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
    toolIcon: { fontSize: 18 },
    publishButton: {
      backgroundColor: colors.primary,
      borderRadius: 22,
      paddingVertical: 11,
      paddingHorizontal: 22,
    },
    publishButtonDisabled: { opacity: 0.4 },
    publishText: { color: '#fff', fontSize: 13, fontWeight: '900' },

    // FOTO ÖNİZLEME (composer)
    imagePreviewWrap: { marginTop: 12, position: 'relative' },
    imagePreview: { width: '100%', height: 180, borderRadius: 14, backgroundColor: colors.cardAlt },
    imageRemove: {
      position: 'absolute', top: 8, right: 8,
      width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center', justifyContent: 'center',
    },
    imageRemoveText: { color: '#fff', fontSize: 14, fontWeight: '900' },

    // ANKET EDİTÖRÜ (composer)
    pollEditor: { marginTop: 12, gap: 8 },
    pollOptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pollOptInput: {
      flex: 1, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, color: colors.text, fontSize: 14,
    },
    pollOptRemove: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
    pollOptRemoveText: { color: '#E94560', fontSize: 14, fontWeight: '900' },
    pollAddBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
    pollAddText: { color: colors.primary, fontSize: 13, fontWeight: '800' },

    // GÖNDERİ FOTO + ANKET (kart)
    postImage: { width: '100%', height: 220, borderRadius: 14, marginTop: 12, backgroundColor: colors.cardAlt },
    pollWrap: { marginTop: 12, gap: 8 },
    pollBar: {
      position: 'relative', overflow: 'hidden',
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.cardAlt, minHeight: 42, justifyContent: 'center',
    },
    pollBarVoted: { borderColor: colors.primary },
    pollFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary + '26' },
    pollFillVoted: { backgroundColor: colors.primary + '40' },
    pollBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
    pollOptText: { color: colors.text, fontSize: 13.5, fontWeight: '700', flex: 1 },
    pollOptTextVoted: { color: colors.primary, fontWeight: '900' },
    pollPct: { color: colors.text, fontSize: 13, fontWeight: '900', marginLeft: 10 },
    pollTotal: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '600', marginTop: 2 },

    // FEED BAŞLIĞI
    feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    feedTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
    feedCountPill: {
      backgroundColor: colors.primary, borderRadius: 11,
      minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center',
    },
    feedCountText: { color: '#fff', fontSize: 12, fontWeight: '900' },

    // KİLİTLİ / BOŞ DURUM
    lockedCard: {
      alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 18, paddingVertical: 32, paddingHorizontal: 24,
    },
    lockedEmoji: { fontSize: 36, marginBottom: 10 },
    lockedText: { color: colors.textSecondary, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
    emptyCard: { alignItems: 'center', paddingVertical: 36 },
    emptyEmoji: { fontSize: 42, marginBottom: 12, opacity: 0.85 },
    emptyTitle: { color: colors.textSecondary, fontSize: 13.5, textAlign: 'center', lineHeight: 20, paddingHorizontal: 30 },
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
