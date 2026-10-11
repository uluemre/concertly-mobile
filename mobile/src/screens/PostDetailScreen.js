import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator,
  Platform, Alert, Image, Animated,
} from 'react-native';
import { KeyboardAvoidingView } from '../components/keyboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { PostSkeletonPage } from '../components/SkeletonLoader';
import { hapticLight } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiErrorMessage } from '../utils/communityErrors';
import API from '../services/api';
import DeepLinkLoader from '../components/DeepLinkLoader';
import {
  publishPostUpdate, publishPostRemoved, publishUserHidden, isPostEdited,
} from '../services/postUpdates';
import { formatTimeAgo } from '../utils/time';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import PollCard from '../components/feed/PollCard';
import usePostActions from '../components/feed/usePostActions';
import { useReport, confirmBlock } from '../components/ReportSheet';

function PostDetailContent({ route, navigation }) {
  const { post: initialPost } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t, lang } = useLanguage();

  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsError, setCommentsError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(!!initialPost.likedByMe);
  const [likeCount, setLikeCount] = useState(initialPost.likeCount || 0);
  const [likeLoading, setLikeLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const isPostOwner = post.userId === session.userId;
  // Yorumlar yüklendiyse sayaç görünen yorumlardan gelir (başlık ve aksiyon aynı sayıyı gösterir)
  const commentTotal = !loading && !commentsError ? comments.length : (post.commentCount || 0);

  // Gönderinin "⋯" menüsü (akış kartıyla ortak)
  const { openOptions, actionElements } = usePostActions({
    post,
    currentUserId: session.userId,
    onDeleted: (id) => { publishPostRemoved(id); goBackOrFallback(navigation); },
    onEdited: (id, updated) => {
      setPost(prev => ({ ...prev, content: updated.content, updatedAt: updated.updatedAt }));
      publishPostUpdate(id, { content: updated.content, updatedAt: updated.updatedAt });
    },
    onBlocked: (userId) => { publishUserHidden(userId); goBackOrFallback(navigation); },
  });
  // Yorum şikâyeti
  const { openReport, reportSheet } = useReport();

  const fetchComments = useCallback(async () => {
    setCommentsError(false);
    try {
      const res = await API.get(`/posts/${post.id}/comments`);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Hata "henüz yorum yok" gibi görünmesin: ayrı durum + tekrar dene
      setCommentsError(true);
    } finally {
      setLoading(false);
    }
  }, [post.id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Görünen yorum sayısı değişince (yükleme, ekleme, silme) diğer ekranlardaki kart da
  // aynı sayıyı göstersin
  useEffect(() => {
    if (loading || commentsError) return;
    if (comments.length === (post.commentCount || 0)) return;
    setPost(prev => ({ ...prev, commentCount: comments.length }));
    publishPostUpdate(post.id, { commentCount: comments.length });
  }, [comments.length, loading, commentsError]); // eslint-disable-line react-hooks/exhaustive-deps

  // İyimser beğeni (akış kartıyla aynı kural): hata olursa geri al ve bildir
  const handleLike = async () => {
    if (likeLoading) return;
    hapticLight();
    const wasLiked = liked;
    const prevCount = likeCount;
    const nextCount = wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
    setLikeLoading(true);
    setLiked(!wasLiked);
    setLikeCount(nextCount);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.4, useNativeDriver: true, tension: 200 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    try {
      if (wasLiked) await API.delete(`/posts/${post.id}/like`);
      else await API.post(`/posts/${post.id}/like`);
      publishPostUpdate(post.id, { likedByMe: !wasLiked, likeCount: nextCount });
    } catch (err) {
      const status = err?.response?.status;
      if ((!wasLiked && status === 409) || (wasLiked && status === 404)) {
        publishPostUpdate(post.id, { likedByMe: !wasLiked, likeCount: nextCount });
      } else {
        setLiked(wasLiked);
        setLikeCount(prevCount);
        Alert.alert('', t('like_failed'));
      }
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await API.post(`/posts/${post.id}/comments`, {
        userId: session.userId,
        content: text.trim(),
      });
      setText('');
      // Yorumlar eskiden yeniye sıralı: yeni yorum sona eklenir
      setComments(prev => [...prev, res.data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'postdetail_error'));
    } finally {
      setSending(false);
    }
  };

  const deleteComment = useCallback((commentId) => {
    Alert.alert(t('postdetail_delete_title'), t('postdetail_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/posts/${post.id}/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
          } catch (err) {
            Alert.alert(t('error'), apiErrorMessage(err, t, 'postdetail_del_error'));
          }
        },
      },
    ]);
  }, [post.id, t]);

  // Yorum menüsü. Android Alert en fazla 3 düğme gösterir; her durumda ≤3 seçenek:
  // kendi yorumun → Sil; kendi gönderinde başkasının yorumu → Şikâyet / Sil;
  // diğerleri → Şikâyet / Engelle.
  const openCommentOptions = useCallback((comment) => {
    const mine = comment.userId === session.userId;
    if (mine) { deleteComment(comment.id); return; }
    const report = { text: t('mod_report'), onPress: () => openReport('COMMENT', comment.id) };
    const cancel = { text: t('mod_cancel'), style: 'cancel' };
    const second = isPostOwner
      ? { text: t('delete'), style: 'destructive', onPress: () => deleteComment(comment.id) }
      : {
        text: t('mod_block'), style: 'destructive', onPress: () => confirmBlock(t, comment.userId, () => {
          setComments(prev => prev.filter(c => c.userId !== comment.userId));
          publishUserHidden(comment.userId);
        }),
      };
    Alert.alert(t('mod_options_title'), null, [report, second, cancel]);
  }, [session.userId, isPostOwner, t, openReport, deleteComment]);

  const goToUser = useCallback((userId) => {
    if (userId === session.userId) {
      navigation.navigate('MainApp', { screen: 'Profile' });
    } else {
      navigation.navigate('UserProfile', { userId });
    }
  }, [session.userId, navigation]);

  const renderComment = useCallback(({ item }) => (
    <View style={styles.commentItem}>
      <TouchableOpacity onPress={() => goToUser(item.userId)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`@${item.username}`}>
        <View style={styles.commentAvatar}>
          {item.userProfileImageUrl ? (
            <Image source={{ uri: item.userProfileImageUrl }} style={styles.commentAvatarImg} />
          ) : (
            <Text style={styles.commentAvatarText}>
              {item.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.commentBubble}>
        <View style={styles.commentHeader}>
          <TouchableOpacity onPress={() => goToUser(item.userId)} activeOpacity={0.8} style={styles.commentUserBtn}>
            <Text style={styles.commentUsername} numberOfLines={1}>@{item.username}</Text>
          </TouchableOpacity>
          <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt, lang)}</Text>
          <TouchableOpacity
            onPress={() => openCommentOptions(item)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            style={styles.commentMore}
            accessibilityRole="button"
            accessibilityLabel={item.userId === session.userId ? t('delete') : t('mod_options_title')}
          >
            <Ionicons name={item.userId === session.userId ? 'trash-outline' : 'ellipsis-horizontal'} size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    </View>
  ), [styles, colors, lang, t, session.userId, goToUser, openCommentOptions]);

  // Başlık bir eleman olarak (bileşen değil) verilir: yorum yazarken her tuşta
  // sökülüp yeniden kurulmaz (görsel yeniden yüklenip titremez).
  const listHeader = useMemo(() => (
    <View style={styles.postSection}>
      {/* Yazar */}
      <TouchableOpacity
        style={styles.postAuthor}
        onPress={() => goToUser(post.userId)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`@${post.username}`}
      >
        <View style={styles.postAvatar}>
          {post.userProfileImageUrl ? (
            <Image source={{ uri: post.userProfileImageUrl }} style={styles.postAvatarImg} />
          ) : (
            <Text style={styles.postAvatarText}>
              {post.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.postUsername}>@{post.username}</Text>
          <Text style={styles.postTime}>
            {formatTimeAgo(post.createdAt, lang)}
            {isPostEdited(post) ? ` · ${t('post_edited')}` : ''}
          </Text>
        </View>
      </TouchableOpacity>

      {/* İçerik */}
      {post.content ? (
        <Text style={styles.postContent} selectable>{post.content}</Text>
      ) : null}
      {post.postType !== 'POLL' && !!post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      )}
      {post.postType === 'POLL' && Array.isArray(post.pollOptions) && post.pollOptions.length > 0 && (
        <View style={styles.pollWrap}>
          <PollCard
            postId={post.id}
            options={post.pollOptions}
            onVoted={(pollOptions) => {
              setPost(prev => ({ ...prev, pollOptions }));
              publishPostUpdate(post.id, { pollOptions });
            }}
          />
        </View>
      )}

      {/* Etkinlik etiketi */}
      {!!post.eventName && !!post.eventId && (
        <TouchableOpacity
          style={styles.eventTag}
          onPress={() => openEvent(navigation, post.eventId)}
          activeOpacity={0.8}
          accessibilityRole="link"
        >
          <View style={styles.eventTagRow}>
            <Ionicons name="musical-notes" size={13} color={colors.primary} />
            <Text style={styles.eventTagText}>{post.eventName}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Aksiyonlar */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleLike}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={`${t('a11y_like')}, ${likeCount}`}
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? colors.primary : colors.textSecondary} />
          </Animated.View>
          <Text style={[styles.actionCount, liked && { color: colors.primary }]}>
            {likeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`${t('a11y_comments')}, ${commentTotal}`}
        >
          <Ionicons name="chatbubble-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.actionCount}>{commentTotal}</Text>
        </TouchableOpacity>
      </View>

      {/* Yorum başlığı */}
      <View style={styles.commentsDivider}>
        <Text style={styles.commentsTitle}>
          {t('postdetail_comments_label')} ({commentTotal})
        </Text>
      </View>
    </View>
    // handleLike her render'da yenidir; başlık yalnızca bu değerler değişince yeniden
    // kurulur ve handleLike'ın kullandığı liked/likeCount/likeLoading hep güncel kalır.
  ), [post, liked, likeCount, likeLoading, commentTotal, styles, colors, lang, t, goToUser, navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  const emptyComments = commentsError ? (
    <View style={styles.emptyComments}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} style={styles.emptyEmoji} />
      <Text style={styles.emptyText}>{t('postdetail_comments_failed')}</Text>
      <TouchableOpacity onPress={() => { setLoading(true); fetchComments(); }} style={styles.retryBtn} accessibilityRole="button">
        <Text style={styles.retryText}>{t('retry')}</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.emptyComments}>
      <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} style={styles.emptyEmoji} />
      <Text style={styles.emptyText}>{t('postdetail_empty')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrFallback(navigation)}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y_back')}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">{t('postdetail_title')}</Text>
        <TouchableOpacity
          onPress={openOptions}
          style={styles.headerMore}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={isPostOwner ? t('profile_post_actions') : t('mod_options_title')}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        {loading ? (
          <PostSkeletonPage />
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={item => item.id.toString()}
            renderItem={renderComment}
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={emptyComments}
          />
        )}

        {/* Yorum girişi */}
        <View style={[styles.inputArea, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { backgroundColor: colors.cardAlt, borderColor: colors.border, color: colors.text }]}
            placeholder={t('postdetail_placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={300}
            accessibilityLabel={t('postdetail_placeholder')}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !text.trim()}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.border }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('send')}
            accessibilityState={{ disabled: sending || !text.trim() }}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {actionElements}
      {reportSheet}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      paddingTop: 56, paddingBottom: 14,
      paddingHorizontal: 20,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    backBtn: { paddingRight: 8 },
    headerMore: { marginLeft: 'auto', padding: 4 },
    backText: { fontSize: 17, fontWeight: '700' },
    headerTitle: { fontSize: 17, fontFamily: fonts.heading, color: colors.text },

    listContent: { paddingBottom: 16 },

    // Post bölümü
    postSection: {
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      paddingBottom: 0,
    },
    postAuthor: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    },
    postAvatar: {
      width: 46, height: 46, borderRadius: 23,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    postAvatarImg: { width: 46, height: 46, borderRadius: 23 },
    postAvatarText: { color: colors.text, fontWeight: '800', fontSize: 18 },
    postUsername: { fontSize: 15, fontWeight: '800', color: colors.text },
    postTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    postImage: { marginHorizontal: 16, aspectRatio: 4 / 3, borderRadius: 14, marginBottom: 14, backgroundColor: colors.cardAlt },
    postContent: {
      fontSize: 16, color: colors.text, lineHeight: 24,
      paddingHorizontal: 16, paddingBottom: 14,
    },

    eventTag: {
      marginHorizontal: 16, marginBottom: 14,
      alignSelf: 'flex-start',
      backgroundColor: colors.primary + '18',
      borderWidth: 1, borderColor: colors.primary + '40',
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    },
    eventTagRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    eventTagText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

    actions: {
      flexDirection: 'row', gap: 24,
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionCount: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

    commentsDivider: {
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    commentsTitle: { fontSize: 14, fontWeight: '800', color: colors.text },

    // Yorum satırı
    commentItem: {
      flexDirection: 'row', gap: 10,
      paddingHorizontal: 16, paddingVertical: 10,
    },
    commentAvatar: {
      width: 36, height: 36, borderRadius: 18,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    commentAvatarImg: { width: 36, height: 36, borderRadius: 18 },
    commentAvatarText: { color: colors.text, fontWeight: '800', fontSize: 14 },
    commentBubble: {
      flex: 1, backgroundColor: colors.card,
      borderRadius: 14, padding: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    commentHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
    },
    commentUserBtn: { flexShrink: 1 },
    commentUsername: { fontSize: 13, fontWeight: '800', color: colors.text },
    commentTime: { fontSize: 11, color: colors.textSecondary, marginLeft: 'auto' },
    commentMore: { paddingLeft: 4 },
    commentText: { fontSize: 14, color: colors.text, lineHeight: 20 },

    // Boş durum
    emptyComments: { alignItems: 'center', paddingVertical: 40 },
    emptyEmoji: { marginBottom: 10 },
    emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
    retryBtn: { marginTop: 12, minHeight: 44, paddingHorizontal: 22, borderRadius: 12, justifyContent: 'center', backgroundColor: colors.primary },
    retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    pollWrap: { paddingHorizontal: 16 },

    // Input
    inputArea: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      paddingHorizontal: 14, paddingVertical: 10,
      borderTopWidth: 1,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    },
    input: {
      flex: 1, borderRadius: 16, borderWidth: 1,
      paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 14, maxHeight: 100,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center',
    },
  });
}

/** Bildirim/paylaşım linki yalnızca `postId` taşır — gönderiyi burada çözüyoruz. */
export default function PostDetailScreen({ route, navigation }) {
  const { post, postId } = route.params || {};
  const [resolved, setResolved] = useState(post || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (resolved || !postId) return;
    let cancelled = false;
    API.get(`/posts/${postId}`)
      .then((res) => !cancelled && setResolved(res.data))
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [postId, resolved]);

  if (!resolved) {
    return <DeepLinkLoader variant="post" error={failed || !postId} onBack={() => navigation.navigate('MainApp')} />;
  }
  return (
    <PostDetailContent
      route={{ ...route, params: { ...route.params, post: resolved } }}
      navigation={navigation}
    />
  );
}
