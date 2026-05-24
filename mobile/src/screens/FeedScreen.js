import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Animated,
  TextInput, KeyboardAvoidingView, Platform,
  Modal, Alert, RefreshControl, Dimensions, Image, Share
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

const { width } = Dimensions.get('window');

const gradientSets = [
  ['#E94560', '#7C3AED'],
  ['#F5A623', '#E94560'],
  ['#00D4AA', '#7C3AED'],
  ['#7C3AED', '#F5A623'],
];

// ── Tek Post Kartı ──────────────────────────────────────────────────────────
const PostCard = React.memo(function PostCard({ item, index, currentUserId, navigation, styles, colors, onLike, onUnlike, onDelete, onEdit }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likeCount || 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState(item.content || '');
  const [editSaving, setEditSaving] = useState(false);

  const isOwner = item.userId === currentUserId;

  const handleOptions = () => {
    Alert.alert('Post İşlemleri', null, [
      { text: 'Düzenle', onPress: () => { setEditText(item.content || ''); setShowEditModal(true); } },
      { text: 'Sil', style: 'destructive', onPress: handleDelete },
      { text: 'İptal', style: 'cancel' },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Postu Sil', 'Bu postu silmek istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/posts/${item.id}`);
            onDelete?.(item.id);
          } catch {
            Alert.alert('Hata', 'Post silinemedi.');
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    try {
      const event = item.eventName ? `🎵 ${item.eventName}` : '';
      const content = item.content ? `"${item.content}"` : '';
      const author = `— @${item.username}`;
      const message = [event, content, author].filter(Boolean).join('\n');
      await Share.share({ message });
    } catch (err) {
      if (err.message !== 'The user did not share') {
        Alert.alert('Hata', 'Paylaşım başarısız.');
      }
    }
  };

  const handleEditSave = async () => {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      const res = await API.patch(`/posts/${item.id}`, { content: editText.trim() });
      onEdit?.(item.id, res.data.content);
      setShowEditModal(false);
    } catch {
      Alert.alert('Hata', 'Post düzenlenemedi.');
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 60,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        delay: index * 60,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);

    // Kalp animasyonu
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.35, useNativeDriver: true, tension: 200 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();

    Animated.sequence([
      Animated.timing(heartAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    try {
      if (liked) {
        await API.delete(`/posts/${item.id}/like?userId=${currentUserId}`);
        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await API.post(`/posts/${item.id}/like?userId=${currentUserId}`);
        setLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (err) {
      console.log('Like hatası:', err.message);
    } finally {
      setLikeLoading(false);
    }
  };

  const goToUserProfile = () => {
    if (item.userId === currentUserId) {
      navigation.navigate('MainApp', { screen: 'Profile' });
    } else {
      navigation.navigate('UserProfile', { userId: item.userId });
    }
  };

  const heartOpacity = heartAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 0],
  });
  const heartScale = heartAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.5, 1.4, 0.8],
  });

  return (
    <Animated.View style={[
      styles.postCard,
      { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      {/* Floating heart animasyonu */}
      <Animated.Text style={[
        styles.floatingHeart,
        { opacity: heartOpacity, transform: [{ scale: heartScale }] }
      ]}>❤️</Animated.Text>

      {/* KULLANICI BAŞLIĞI */}
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postHeaderLeft} onPress={goToUserProfile} activeOpacity={0.75}>
          <LinearGradient
            colors={gradientSets[index % gradientSets.length]}
            style={styles.avatar}
          >
            {item.userProfileImageUrl ? (
              <Image source={{ uri: item.userProfileImageUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {item.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            )}
          </LinearGradient>

          <View style={styles.headerInfo}>
            <Text style={styles.username}>@{item.username}</Text>
            <Text style={styles.eventTag}>🎵 {item.eventName || 'Etkinlik'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.postHeaderRight}>
          <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
          {isOwner && (
            <TouchableOpacity onPress={handleOptions} style={styles.optionsBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.optionsIcon}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* DÜZENLEME MODALI */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <TouchableOpacity style={styles.editOverlay} activeOpacity={1} onPress={() => setShowEditModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editSheetWrapper}>
          <View style={[styles.editSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.editTitle, { color: colors.text }]}>Postu Düzenle</Text>
            <TextInput
              style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.border }]} onPress={() => setShowEditModal(false)}>
                <Text style={[styles.editBtnText, { color: colors.text }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: colors.primary, opacity: editSaving ? 0.6 : 1 }]}
                onPress={handleEditSave}
                disabled={editSaving}
              >
                <Text style={[styles.editBtnText, { color: '#fff' }]}>{editSaving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* İÇERİK */}
      {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}

      {/* GÖRSEL */}
      {item.postType === 'IMAGE' && item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
      )}

      {/* ANKET */}
      {item.postType === 'POLL' && item.pollOptions && (
        <PollCard postId={item.id} options={item.pollOptions} styles={styles} colors={colors} />
      )}

      {/* AKSİYON BUTONLARI */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
          <Animated.Text style={[styles.actionIcon, { transform: [{ scale: scaleAnim }] }]}>
            {liked ? '❤️' : '🤍'}
          </Animated.Text>
          <Text style={[styles.actionCount, liked && styles.actionCountActive]}>
            {likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowComments(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{item.commentCount || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
          <Text style={styles.actionIcon}>🔗</Text>
          <Text style={styles.actionCount}>Paylaş</Text>
        </TouchableOpacity>
      </View>

      {/* YORUM MODALI */}
      <CommentModal
        visible={showComments}
        postId={item.id}
        currentUserId={currentUserId}
        onClose={() => setShowComments(false)}
        styles={styles}
        colors={colors}
      />
    </Animated.View>
  );
});

// ── Anket Kartı ─────────────────────────────────────────────────────────────
function PollCard({ postId, options: initialOptions, styles, colors }) {
  const [options, setOptions] = useState(initialOptions);
  const [voting, setVoting] = useState(false);
  const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);

  const handleVote = async (optionId) => {
    if (voting || options.some(o => o.voted)) return;
    setVoting(true);
    try {
      const res = await API.post(`/posts/${postId}/poll/vote?optionId=${optionId}`);
      setOptions(res.data);
    } catch (err) {
      console.log('Oy hatası:', err.message);
    } finally {
      setVoting(false);
    }
  };

  const hasVoted = options.some(o => o.voted);

  return (
    <View style={styles.pollCard}>
      {options.map(opt => {
        const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.pollOption, opt.voted && styles.pollOptionVoted]}
            onPress={() => handleVote(opt.id)}
            activeOpacity={hasVoted ? 1 : 0.7}
            disabled={hasVoted || voting}
          >
            {hasVoted && (
              <View style={[styles.pollBar, { width: `${pct}%` }]} />
            )}
            <Text style={[styles.pollOptionText, opt.voted && styles.pollOptionTextVoted]}>
              {opt.voted ? '✓ ' : ''}{opt.optionText}
            </Text>
            {hasVoted && (
              <Text style={styles.pollPct}>{pct}%</Text>
            )}
          </TouchableOpacity>
        );
      })}
      <Text style={styles.pollTotal}>{totalVotes} oy</Text>
    </View>
  );
}

// ── Yorum Modali ─────────────────────────────────────────────────────────────
function CommentModal({ visible, postId, currentUserId, onClose, styles, colors }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      fetchComments();
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/posts/${postId}/comments`);
      setComments(res.data);
    } catch (err) {
      console.log('Yorum hatası:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await API.post(`/posts/${postId}/comments`, {
        userId: currentUserId,
        content: text.trim(),
      });
      setText('');
      fetchComments();
    } catch (err) {
      Alert.alert('Hata', 'Yorum gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* TUTAMAK */}
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>💬 Yorumlar</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.sheetClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* YORUMLAR */}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : comments.length === 0 ? (
          <View style={styles.noComments}>
            <Text style={styles.noCommentsEmoji}>💭</Text>
            <Text style={styles.noCommentsText}>İlk yorumu sen yap!</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={c => c.id.toString()}
            style={styles.commentList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>
                    {item.username?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.commentBody}>
                  <Text style={styles.commentUsername}>@{item.username}</Text>
                  <Text style={styles.commentContent}>{item.content}</Text>
                  <Text style={styles.commentTime}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            )}
          />
        )}

        {/* YORUM YAZ */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Bir şeyler yaz... 🎸"
              placeholderTextColor={colors.textSecondary}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={sending || !text.trim()}
              style={[styles.sendBtn, (!text.trim()) && styles.sendBtnDisabled]}
            >
              {sending
                ? <ActivityIndicator size="small" color={colors.text} />
                : <Text style={styles.sendBtnText}>→</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Yardımcı ────────────────────────────────────────────────────────────────
function formatTime(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// ── Ana Feed Ekranı ─────────────────────────────────────────────────────────
export default function FeedScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState('trending');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tabIndicator = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchPosts();
  }, [activeTab]);

  const fetchPosts = async () => {
    try {
      let res;
      if (activeTab === 'trending') {
        res = await API.get('/posts/feed/trending');
      } else {
        res = await API.get(`/posts/feed/following?userId=${global.userId}`);
      }
      setPosts(res.data);
    } catch (err) {
      console.log('Feed hatası:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setLoading(true);
    Animated.spring(tabIndicator, {
      toValue: tab === 'trending' ? 0 : 1,
      tension: 70,
      friction: 10,
      useNativeDriver: false,
    }).start();
  };

  const indicatorLeft = tabIndicator.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const handleDeletePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleEditPost = useCallback((postId, newContent) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent } : p));
  }, []);

  const renderPost = useCallback(({ item, index }) => (
    <PostCard
      item={item}
      index={index}
      currentUserId={global.userId}
      navigation={navigation}
      styles={styles}
      colors={colors}
      onDelete={handleDeletePost}
      onEdit={handleEditPost}
    />
  ), [navigation, styles, colors, handleDeletePost, handleEditPost]);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <Text style={styles.headerTitle}>🔥 Feed</Text>

        {/* SEKMELİ GEÇİŞ */}
        <View style={styles.tabBar}>
          <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('trending')}>
            <Text style={[styles.tabBtnText, activeTab === 'trending' && styles.tabBtnTextActive]}>
              🔥 Trending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('following')}>
            <Text style={[styles.tabBtnText, activeTab === 'following' && styles.tabBtnTextActive]}>
              👥 Takip
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* POSTLAR */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Postlar yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id.toString()}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>
                {activeTab === 'following' ? '👥' : '📭'}
              </Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'following' ? 'Takip ettiğin kimse yok' : 'Henüz post yok'}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'following'
                  ? 'Kullanıcıları takip et, onların postlarını burada gör'
                  : 'İlk postu sen at! Bir konsere git 🎸'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── STİLLER ─────────────────────────────────────────────────────────────────
function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // HEADER
    header: {
      paddingTop: 60,
      paddingBottom: 16,
      paddingHorizontal: 20,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      letterSpacing: -0.5,
    },

    // TAB BAR
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      padding: 4,
      position: 'relative',
      overflow: 'hidden',
    },
    tabIndicator: {
      position: 'absolute',
      top: 4,
      width: '50%',
      bottom: 4,
      backgroundColor: colors.primary,
      borderRadius: 10,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      zIndex: 1,
    },
    tabBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabBtnTextActive: {
      color: '#fff',
    },

    // LOADING
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: colors.textSecondary, fontSize: 14 },

    // LIST
    listContent: { padding: 16, paddingBottom: 32 },

    // POST KARTI
    postCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
      overflow: 'hidden',
    },
    floatingHeart: {
      position: 'absolute',
      top: '40%',
      alignSelf: 'center',
      fontSize: 48,
      zIndex: 10,
    },

    // POST HEADER
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    postHeaderLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    postHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    optionsBtn: { padding: 4 },
    optionsIcon: { fontSize: 20, color: colors.textSecondary, letterSpacing: 1 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    avatarText: { color: colors.text, fontWeight: 'bold', fontSize: 18 },
    headerInfo: { flex: 1 },
    username: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    eventTag: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    postTime: { fontSize: 11, color: colors.textSecondary },
    editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    editSheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    editSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
    editTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
    editInput: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 14,
    },
    editActions: { flexDirection: 'row', gap: 10 },
    editBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    editBtnText: { fontSize: 15, fontWeight: '700' },

    // POST İÇERİK
    postContent: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      marginBottom: 14,
    },

    postImage: {
      width: '100%', height: 220, borderRadius: 12,
      marginBottom: 14, overflow: 'hidden',
    },

    // ANKET
    pollCard: { gap: 8, marginBottom: 14 },
    pollOption: {
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 12, flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, overflow: 'hidden', position: 'relative',
      minHeight: 44,
    },
    pollOptionVoted: { borderColor: colors.primary },
    pollBar: {
      position: 'absolute', left: 0, top: 0, bottom: 0,
      backgroundColor: colors.primary + '22', borderRadius: 12,
    },
    pollOptionText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
    pollOptionTextVoted: { color: colors.primary },
    pollPct: { fontSize: 13, fontWeight: '800', color: colors.primary },
    pollTotal: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },

    // AKSİYONLAR
    actions: {
      flexDirection: 'row',
      gap: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionIcon: { fontSize: 20 },
    actionCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    actionCountActive: { color: colors.primary },

    // YORUM MODALI
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '75%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    sheetHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 12, marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    sheetClose: { fontSize: 18, color: colors.textSecondary, padding: 4 },

    noComments: { alignItems: 'center', paddingVertical: 40 },
    noCommentsEmoji: { fontSize: 40, marginBottom: 10 },
    noCommentsText: { color: colors.textSecondary, fontSize: 14 },

    commentList: { maxHeight: 320, paddingHorizontal: 16 },
    commentItem: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    commentAvatar: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    commentAvatarText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
    commentBody: { flex: 1 },
    commentUsername: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 3 },
    commentContent: { fontSize: 14, color: colors.text, lineHeight: 19 },
    commentTime: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },

    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    commentInput: {
      flex: 1,
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: colors.border },
    sendBtnText: { color: colors.text, fontSize: 18, fontWeight: 'bold' },

    // BOŞ DURUM
    empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' },
    emptySubtext: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  });
}