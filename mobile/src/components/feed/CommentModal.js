import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, TextInput,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Animated, Alert,
} from 'react-native';
import API from '../../services/api';
import { useTheme } from '../../theme';
import { formatTimeAgo } from '../../utils/time';

export default function CommentModal({ visible, postId, currentUserId, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      fetchComments();
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }).start();
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
      await API.post(`/posts/${postId}/comments`, { userId: currentUserId, content: text.trim() });
      setText('');
      fetchComments();
    } catch {
      Alert.alert('Hata', 'Yorum gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>💬 Yorumlar</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : comments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💭</Text>
            <Text style={styles.emptyText}>İlk yorumu sen yap!</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={c => c.id.toString()}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.username?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.commentBody}>
                  <Text style={styles.commentUsername}>@{item.username}</Text>
                  <Text style={styles.commentContent}>{item.content}</Text>
                  <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
                </View>
              </View>
            )}
          />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
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
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            >
              {sending
                ? <ActivityIndicator size="small" color={colors.text} />
                : <Text style={styles.sendBtnText}>→</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: '75%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border, alignSelf: 'center',
      marginTop: 12, marginBottom: 4,
    },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    close: { fontSize: 18, color: colors.textSecondary, padding: 4 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyEmoji: { fontSize: 40, marginBottom: 10 },
    emptyText: { color: colors.textSecondary, fontSize: 14 },
    list: { maxHeight: 320, paddingHorizontal: 16 },
    commentItem: {
      flexDirection: 'row', gap: 10, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    avatar: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
    commentBody: { flex: 1 },
    commentUsername: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 3 },
    commentContent: { fontSize: 14, color: colors.text, lineHeight: 19 },
    commentTime: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      paddingHorizontal: 16, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    input: {
      flex: 1, backgroundColor: colors.cardAlt, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 10,
      color: colors.text, fontSize: 14, maxHeight: 100,
      borderWidth: 1, borderColor: colors.border,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: colors.border },
    sendBtnText: { color: colors.text, fontSize: 18, fontWeight: 'bold' },
  });
}
