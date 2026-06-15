import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, Image, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { formatTimeAgo } from '../utils/time';

const GRADIENTS = [
  ['#E94560', '#7C3AED'],
  ['#F5A623', '#E94560'],
  ['#00D4AA', '#7C3AED'],
  ['#7C3AED', '#F5A623'],
];

export default function PostDetailScreen({ route, navigation }) {
  const { post: initialPost } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t } = useLanguage();

  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(!!initialPost.likedByMe);
  const [likeCount, setLikeCount] = useState(initialPost.likeCount || 0);
  const [likeLoading, setLikeLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const isOwner = post.userId === session.userId;

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      const res = await API.get(`/posts/${post.id}/comments`);
      setComments(res.data);
    } catch (err) {
      console.log('comment fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.4, useNativeDriver: true, tension: 200 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    try {
      if (liked) {
        await API.delete(`/posts/${post.id}/like`);
        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await API.post(`/posts/${post.id}/like`);
        setLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (err) {
      console.log('Like hatası:', err.message);
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
      setComments(prev => [...prev, res.data]);
      setPost(prev => ({ ...prev, commentCount: (prev.commentCount || 0) + 1 }));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert(t('error'), t('postdetail_error'));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = useCallback((commentId) => {
    Alert.alert(t('postdetail_delete_title'), t('postdetail_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/posts/${post.id}/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
            setPost(prev => ({ ...prev, commentCount: Math.max(0, (prev.commentCount || 0) - 1) }));
          } catch {
            Alert.alert(t('error'), t('postdetail_del_error'));
          }
        },
      },
    ]);
  }, [post.id]);

  const goToUser = (userId) => {
    if (userId === session.userId) {
      navigation.navigate('MainApp', { screen: 'Profile' });
    } else {
      navigation.navigate('UserProfile', { userId });
    }
  };

  const renderComment = useCallback(({ item, index }) => (
    <View style={styles.commentItem}>
      <TouchableOpacity onPress={() => goToUser(item.userId)} activeOpacity={0.8}>
        <LinearGradient
          colors={GRADIENTS[index % GRADIENTS.length]}
          style={styles.commentAvatar}
        >
          {item.userProfileImageUrl ? (
            <Image source={{ uri: item.userProfileImageUrl }} style={styles.commentAvatarImg} />
          ) : (
            <Text style={styles.commentAvatarText}>
              {item.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.commentBubble}>
        <View style={styles.commentHeader}>
          <TouchableOpacity onPress={() => goToUser(item.userId)} activeOpacity={0.8}>
            <Text style={styles.commentUsername}>@{item.username}</Text>
          </TouchableOpacity>
          <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
        {item.userId === session.userId && (
          <TouchableOpacity
            onPress={() => handleDeleteComment(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteCommentBtn}
          >
            <Text style={styles.deleteCommentText}>{t('delete')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [session.userId, handleDeleteComment]);

  const ListHeader = () => (
    <View style={styles.postSection}>
      {/* Yazar */}
      <TouchableOpacity
        style={styles.postAuthor}
        onPress={() => goToUser(post.userId)}
        activeOpacity={0.8}
      >
        <LinearGradient colors={GRADIENTS[0]} style={styles.postAvatar}>
          {post.userProfileImageUrl ? (
            <Image source={{ uri: post.userProfileImageUrl }} style={styles.postAvatarImg} />
          ) : (
            <Text style={styles.postAvatarText}>
              {post.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </LinearGradient>
        <View>
          <Text style={styles.postUsername}>@{post.username}</Text>
          <Text style={styles.postTime}>{formatTimeAgo(post.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      {/* İçerik */}
      {post.content ? (
        <Text style={styles.postContent}>{post.content}</Text>
      ) : null}

      {/* Etkinlik etiketi */}
      {post.eventName && (
        <TouchableOpacity
          style={styles.eventTag}
          onPress={() => post.eventId && navigation.navigate('EventDetail', { event: { id: post.eventId, name: post.eventName } })}
          activeOpacity={0.8}
        >
          <Text style={styles.eventTagText}>🎵 {post.eventName}</Text>
        </TouchableOpacity>
      )}

      {/* Aksiyonlar */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
          <Animated.Text style={[styles.actionIcon, { transform: [{ scale: scaleAnim }] }]}>
            {liked ? '❤️' : '🤍'}
          </Animated.Text>
          <Text style={[styles.actionCount, liked && { color: colors.primary }]}>
            {likeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => inputRef.current?.focus()} activeOpacity={0.7}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.commentCount || comments.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Yorum başlığı */}
      <View style={styles.commentsDivider}>
        <Text style={styles.commentsTitle}>
          {t('postdetail_comments_label')} ({comments.length})
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('postdetail_title')}</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={item => item.id.toString()}
            renderItem={renderComment}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyEmoji}>💭</Text>
                <Text style={styles.emptyText}>{t('postdetail_empty')}</Text>
              </View>
            }
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
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !text.trim()}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.border }]}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendIcon}>→</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    backText: { fontSize: 17, fontWeight: '700' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },

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
    },
    postAvatarImg: { width: 46, height: 46, borderRadius: 23 },
    postAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
    postUsername: { fontSize: 15, fontWeight: '800', color: colors.text },
    postTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

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
    eventTagText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

    actions: {
      flexDirection: 'row', gap: 24,
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionIcon: { fontSize: 22 },
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
    },
    commentAvatarImg: { width: 36, height: 36, borderRadius: 18 },
    commentAvatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    commentBubble: {
      flex: 1, backgroundColor: colors.card,
      borderRadius: 14, padding: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    commentHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 4,
    },
    commentUsername: { fontSize: 13, fontWeight: '800', color: colors.text },
    commentTime: { fontSize: 11, color: colors.textSecondary },
    commentText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    deleteCommentBtn: { marginTop: 6, alignSelf: 'flex-end' },
    deleteCommentText: { fontSize: 11, color: colors.textSecondary },

    // Boş durum
    emptyComments: { alignItems: 'center', paddingVertical: 40 },
    emptyEmoji: { fontSize: 40, marginBottom: 10 },
    emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },

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
    sendIcon: { color: '#fff', fontSize: 20, fontWeight: '800' },
  });
}
