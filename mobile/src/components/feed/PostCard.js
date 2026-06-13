import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  Alert, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../../services/api';
import { useTheme } from '../../theme';
import { formatTimeAgo } from '../../utils/time';
import PollCard from './PollCard';
import CommentModal from './CommentModal';

const GRADIENTS = [
  ['#E94560', '#7C3AED'],
  ['#F5A623', '#E94560'],
  ['#00D4AA', '#7C3AED'],
  ['#7C3AED', '#F5A623'],
];

export default React.memo(function PostCard({
  item, index, currentUserId, navigation, onDelete, onEdit,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Floating hearts
  const floatAnims = useRef([0, 1, 2].map(() => ({
    y:       new Animated.Value(0),
    opacity: new Animated.Value(0),
    x:       new Animated.Value(0),
  }))).current;

  const fireFloatingHearts = () => {
    floatAnims.forEach((a, i) => {
      a.y.setValue(0);
      a.opacity.setValue(0);
      a.x.setValue((i - 1) * 18);
      Animated.sequence([
        Animated.delay(i * 80),
        Animated.parallel([
          Animated.timing(a.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(a.y, { toValue: -60 - i * 12, duration: 700, useNativeDriver: true }),
          Animated.timing(a.x, { toValue: a.x._value + (i - 1) * 12, duration: 700, useNativeDriver: true }),
        ]),
        Animated.timing(a.opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likeCount || 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState(item.content || '');
  const [editSaving, setEditSaving] = useState(false);

  const isOwner = item.userId === currentUserId;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0, delay: index * 60, tension: 60, friction: 9, useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1, delay: index * 60, duration: 280, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.35, useNativeDriver: true, tension: 200 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    Animated.sequence([
      Animated.timing(heartAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    if (!liked) fireFloatingHearts();
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

  const handleShare = async () => {
    try {
      const parts = [
        item.eventName ? `🎵 ${item.eventName}` : '',
        item.content ? `"${item.content}"` : '',
        `— @${item.username}`,
      ].filter(Boolean);
      await Share.share({ message: parts.join('\n') });
    } catch (err) {
      if (err.message !== 'The user did not share') {
        Alert.alert('Hata', 'Paylaşım başarısız.');
      }
    }
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

  const handleOptions = () => {
    Alert.alert('Post İşlemleri', null, [
      { text: 'Düzenle', onPress: () => { setEditText(item.content || ''); setShowEditModal(true); } },
      { text: 'Sil', style: 'destructive', onPress: handleDelete },
      { text: 'İptal', style: 'cancel' },
    ]);
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

  const goToUserProfile = () => {
    if (item.userId === currentUserId) {
      navigation.navigate('MainApp', { screen: 'Profile' });
    } else {
      navigation.navigate('UserProfile', { userId: item.userId });
    }
  };

  const heartOpacity = heartAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
  const heartScale = heartAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.4, 0.8] });

  return (
    <Animated.View style={[styles.card, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>
      <Animated.Text style={[styles.floatingHeart, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}>
        ❤️
      </Animated.Text>

      {/* Yükselen kalpler */}
      {floatAnims.map((a, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            bottom: 44,
            left: 20 + i * 14,
            fontSize: 14 + i * 2,
            opacity: a.opacity,
            transform: [{ translateY: a.y }, { translateX: a.x }],
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          ❤️
        </Animated.Text>
      ))}

      {/* BAŞLIK */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={goToUserProfile} activeOpacity={0.75}>
          <LinearGradient colors={GRADIENTS[index % GRADIENTS.length]} style={styles.avatar}>
            {item.userProfileImageUrl
              ? <Image source={{ uri: item.userProfileImageUrl }} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>{item.username?.charAt(0).toUpperCase() || '?'}</Text>}
          </LinearGradient>
          <View style={styles.headerInfo}>
            <Text style={styles.username}>@{item.username}</Text>
            <Text style={styles.eventTag}>🎵 {item.eventName || 'Etkinlik'}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.postTime}>{formatTimeAgo(item.createdAt)}</Text>
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

      {/* İÇERİK — tıklayınca detay */}
      {item.content ? (
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('PostDetail', { post: item })}>
          <Text style={styles.content} numberOfLines={4}>{item.content}</Text>
        </TouchableOpacity>
      ) : null}
      {item.postType === 'IMAGE' && item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.postImage} contentFit="cover" transition={150} />
      )}
      {item.postType === 'POLL' && item.pollOptions && (
        <PollCard postId={item.id} options={item.pollOptions} />
      )}

      {/* AKSİYONLAR */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
          <Animated.Text style={[styles.actionIcon, { transform: [{ scale: scaleAnim }] }]}>
            {liked ? '❤️' : '🤍'}
          </Animated.Text>
          <Text style={[styles.actionCount, liked && styles.actionCountActive]}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PostDetail', { post: item })}
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

      <CommentModal
        visible={showComments}
        postId={item.id}
        currentUserId={currentUserId}
        onClose={() => setShowComments(false)}
      />
    </Animated.View>
  );
});

function createStyles(colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card, borderRadius: 20, padding: 16,
      marginBottom: 14, borderWidth: 1, borderColor: colors.border,
      position: 'relative', overflow: 'hidden',
    },
    floatingHeart: {
      position: 'absolute', top: '40%', alignSelf: 'center', fontSize: 48, zIndex: 10,
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    optionsBtn: { padding: 4 },
    optionsIcon: { fontSize: 20, color: colors.textSecondary, letterSpacing: 1 },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
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
      borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15,
      minHeight: 100, textAlignVertical: 'top', marginBottom: 14,
    },
    editActions: { flexDirection: 'row', gap: 10 },
    editBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    editBtnText: { fontSize: 15, fontWeight: '700' },
    content: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 14 },
    postImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
    actions: {
      flexDirection: 'row', gap: 20, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionIcon: { fontSize: 20 },
    actionCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    actionCountActive: { color: colors.primary },
  });
}
