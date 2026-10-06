import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, Platform, Image, Alert, AppState, Keyboard,
} from 'react-native';
import { KeyboardAvoidingView } from '../components/keyboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiErrorMessage } from '../utils/communityErrors';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';

function formatClock(dateStr, lang) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(lang === 'en' ? 'en-US' : 'tr-TR', {
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ChatScreen({ navigation, route }) {
  const { userId, username, profileImageUrl, sharedEventName, initialText } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(initialText || '');
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hidden = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
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
    const startPolling = () => {
      clearInterval(pollRef.current);
      if (AppState.currentState === 'active') {
        pollRef.current = setInterval(fetchMessages, 4000);
      }
    };
    startPolling();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') startPolling();
      else clearInterval(pollRef.current);
    });
    return () => { clearInterval(pollRef.current); sub.remove(); };
  }, [fetchMessages]));

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await API.post('/messages', { receiverId: userId, content });
      setMessages(prev => [...prev, res.data]);
    } catch (err) {
      setText(content); // geri koy, kullanıcı tekrar denesin
      Alert.alert(t('error'), apiErrorMessage(err, t, 'chat_send_error'));
    } finally {
      setSending(false);
    }
  };

  const submitReport = async (reason) => {
    try {
      await API.post('/reports', { targetType: 'USER', targetId: userId, reason });
      Alert.alert(t('mod_reported_title'), t('mod_reported_msg'));
    } catch {
      Alert.alert('', t('mod_error'));
    }
  };

  const handleModeration = () => {
    Alert.alert(t('mod_options_title'), `@${username}`, [
      {
        text: t('mod_report'), onPress: () => Alert.alert(t('mod_reason_title'), null, [
          { text: t('mod_reason_spam'), onPress: () => submitReport('SPAM') },
          { text: t('mod_reason_harassment'), onPress: () => submitReport('HARASSMENT') },
          { text: t('mod_reason_inappropriate'), onPress: () => submitReport('INAPPROPRIATE') },
          { text: t('mod_cancel'), style: 'cancel' },
        ]),
      },
      {
        text: t('mod_block'), style: 'destructive', onPress: () => Alert.alert(t('mod_block_title'), t('mod_block_msg'), [
          { text: t('mod_cancel'), style: 'cancel' },
          {
            text: t('mod_block'), style: 'destructive', onPress: async () => {
              try {
                await API.post(`/users/${userId}/block`);
                Alert.alert('', t('mod_blocked_msg'));
                goBackOrFallback(navigation);
              } catch {
                Alert.alert('', t('mod_error'));
              }
            },
          },
        ]),
      },
      { text: t('mod_cancel'), style: 'cancel' },
    ]);
  };

  // FlatList inverted çalışır → en yeni mesaj başa gelecek şekilde ters çevir
  const inverted = useMemo(() => [...messages].reverse(), [messages]);

  const renderMessage = ({ item }) => {
    const mine = item.senderId === session.userId;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        {mine ? (
          // Kendi mesajın: düz marka rengi balon
          <View style={[styles.bubble, styles.bubbleMine, { backgroundColor: colors.primary }]}>
            <Text style={styles.bubbleTextMine}>{item.content}</Text>
            <Text style={styles.bubbleTimeMine}>{formatClock(item.createdAt, lang)}</Text>
          </View>
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

  const canSend = !!text.trim() && !sending;
  // Klavye kapalıyken alt çubuk iPhone'un alt çizgisinin (home indicator) üstünde dursun;
  // klavye açıkken bu boşluk gereksiz (klavye zaten altta).
  const composerBottom = keyboardOpen ? 8 : Math.max(insets.bottom, 10);

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerUser}
          onPress={() => navigation.navigate('UserProfile', { userId })}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`@${username}`}
        >
          <View style={styles.headerAvatar}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={styles.headerAvatarText}>{username?.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View>
            <Text style={[styles.headerUsername, { color: colors.text }]}>@{username}</Text>
            {sharedEventName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="musical-notes-outline" size={11} color={colors.textSecondary} />
                <Text style={[styles.headerEvent, { color: colors.textSecondary, marginTop: 0, flexShrink: 1 }]} numberOfLines={1}>
                  {sharedEventName}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleModeration} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('mod_options_title')}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} style={styles.moreText} />
        </TouchableOpacity>
      </View>

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

      {/* MESAJ YAZMA ALANI: tek hap biçimli kutu, gönder butonu kutunun içinde */}
      <View style={[styles.inputBar, { backgroundColor: colors.background, paddingBottom: composerBottom }]}>
        <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t('chat_placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            accessibilityLabel={t('chat_placeholder')}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('send')}
            accessibilityState={{ disabled: !canSend, busy: sending }}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : 'transparent' }]}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color={text.trim() ? '#fff' : colors.textSecondary} />}
          </TouchableOpacity>
        </View>
        {text.length > 900 && (
          <Text style={[styles.counter, { color: colors.textSecondary }]}>{text.length}/1000</Text>
        )}
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
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    headerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
    headerAvatarText: { color: colors.text, fontSize: 16, fontWeight: '900' },
    headerUsername: { fontSize: 17, fontWeight: '800' },
    headerEvent: { fontSize: 11, marginTop: 1 },
    moreText: { paddingHorizontal: 4 },

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

    inputBar: { paddingHorizontal: 12, paddingTop: 8 },
    composer: {
      flexDirection: 'row', alignItems: 'flex-end',
      borderWidth: 1, borderRadius: 24,
      paddingLeft: 16, paddingRight: 5, paddingVertical: 5,
    },
    input: {
      flex: 1, fontSize: 15, lineHeight: 20,
      paddingTop: Platform.OS === 'ios' ? 8 : 6, paddingBottom: Platform.OS === 'ios' ? 8 : 6,
      maxHeight: 120,
    },
    sendBtn: {
      width: 36, height: 36, borderRadius: 18, marginLeft: 6,
      justifyContent: 'center', alignItems: 'center',
    },
    counter: { fontSize: 11, textAlign: 'right', marginTop: 4, marginRight: 6 },
  });
}
