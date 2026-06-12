import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';

function formatClock(dateStr, lang) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(lang === 'en' ? 'en-US' : 'tr-TR', {
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ChatScreen({ navigation, route }) {
  const { userId, username, profileImageUrl } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await API.get(`/messages/with/${userId}`);
      setMessages(res.data);
    } catch (err) {
      console.log('Chat error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 4000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]));

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await API.post('/messages', { receiverId: userId, content });
      setMessages(prev => [...prev, res.data]);
    } catch {
      setText(content); // geri koy, kullanıcı tekrar denesin
      Alert.alert(t('error'), t('chat_send_error'));
    } finally {
      setSending(false);
    }
  };

  // FlatList inverted çalışır → en yeni mesaj başa gelecek şekilde ters çevir
  const inverted = useMemo(() => [...messages].reverse(), [messages]);

  const renderMessage = ({ item }) => {
    const mine = item.senderId === session.userId;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        {mine ? (
          <LinearGradient
            colors={['#E94560', '#7C3AED']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.bubble, styles.bubbleMine]}
          >
            <Text style={styles.bubbleTextMine}>{item.content}</Text>
            <Text style={styles.bubbleTimeMine}>{formatClock(item.createdAt, lang)}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleTheirs, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.bubbleTextTheirs, { color: colors.text }]}>{item.content}</Text>
            <Text style={[styles.bubbleTimeTheirs, { color: colors.textSecondary }]}>
              {formatClock(item.createdAt, lang)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* HEADER */}
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerUser}
          onPress={() => navigation.navigate('UserProfile', { userId })}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#00D4AA', '#3B82F6']} style={styles.headerAvatar}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={styles.headerAvatarText}>{username?.charAt(0).toUpperCase()}</Text>
            )}
          </LinearGradient>
          <Text style={[styles.headerUsername, { color: colors.text }]}>@{username}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* MESSAGES */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={inverted}
          inverted
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              {/* inverted liste empty bileşenini ters çevirir */}
              <Text style={[styles.emptyText, { color: colors.textSecondary, transform: [{ scaleY: -1 }] }]}>
                {t('chat_empty')}
              </Text>
            </View>
          }
        />
      )}

      {/* INPUT */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          placeholder={t('chat_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={text.trim() ? ['#E94560', '#7C3AED'] : [colors.cardAlt, colors.cardAlt]}
            style={styles.sendBtn}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendBtnText}>➤</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20,
    },
    backText: { fontSize: 32, fontWeight: '600', lineHeight: 34 },
    headerUser: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    headerAvatar: {
      width: 40, height: 40, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    headerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
    headerAvatarText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    headerUsername: { fontSize: 17, fontWeight: '800' },

    bubbleRow: { marginBottom: 10, flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleMine: { borderBottomRightRadius: 4 },
    bubbleTheirs: { borderBottomLeftRadius: 4, borderWidth: 1 },
    bubbleTextMine: { color: '#fff', fontSize: 14.5, lineHeight: 20 },
    bubbleTextTheirs: { fontSize: 14.5, lineHeight: 20 },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
    bubbleTimeTheirs: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { fontSize: 15 },

    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1,
    },
    input: {
      flex: 1, borderWidth: 1, borderRadius: 22,
      paddingHorizontal: 16, paddingVertical: 10,
      fontSize: 14.5, maxHeight: 110,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center',
    },
    sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  });
}
