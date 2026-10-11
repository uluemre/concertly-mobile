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
import { ChatSkeletonPage } from '../components/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiErrorMessage } from '../utils/communityErrors';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { useReport, confirmBlock } from '../components/ReportSheet';
import { publishUserHidden } from '../services/postUpdates';

// Sunucunun mesajlaşmayı kapattığı durumlar → kullanıcıya gösterilen açıklama
const CLOSED_REASON_KEYS = {
  BUDDY_UNMATCHED: 'chat_closed_unmatched',
  BLOCKED: 'chat_closed_blocked',
  PRIVACY: 'chat_closed_privacy',
};

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
  // İlk yükleme başarısızsa "henüz mesaj yok" yerine hata + tekrar dene
  const [loadError, setLoadError] = useState(false);
  // Sohbet kapalıysa (eşleşme kaldırıldı / engel / gizlilik) yazma alanı yerine açıklama
  const [closedReason, setClosedReason] = useState(null);
  const pollRef = useRef(null);
  const messageCountRef = useRef(0);
  messageCountRef.current = messages.length;
  const { openReport, reportSheet } = useReport();

  const fetchMessages = useCallback(async () => {
    try {
      const res = await API.get(`/messages/with/${userId}`);
      const server = Array.isArray(res.data) ? res.data : [];
      setLoadError(false);
      setMessages(prev => {
        // Değişiklik yoksa state'e dokunma (4 sn'de bir gereksiz yeniden çizim olmasın)
        if (prev.length === server.length && prev[prev.length - 1]?.id === server[server.length - 1]?.id) {
          return prev;
        }
        // İstek uçuştayken gönderilmiş ve henüz bu cevapta olmayan mesaj kaybolmasın
        const serverIds = new Set(server.map(m => m.id));
        const lastServerId = server.length ? server[server.length - 1].id : 0;
        const pending = prev.filter(m => !serverIds.has(m.id) && m.id > lastServerId);
        return pending.length ? [...server, ...pending] : server;
      });
    } catch {
      // Ekranda mesaj varken düşen bir yoklama sessiz geçer; hiç mesaj yoksa hata göster
      if (messageCountRef.current === 0) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await API.get(`/messages/status/${userId}`);
      setClosedReason(res.data?.canMessage === false ? (res.data.reason || 'PRIVACY') : null);
    } catch {
      // Durum alınamazsa yazma alanı açık kalır; gönderimde sunucu yine karar verir
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    fetchMessages();
    fetchStatus();
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
  }, [fetchMessages, fetchStatus]));

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
      const code = err?.response?.data?.message;
      if (err?.response?.status === 403 && CLOSED_REASON_KEYS[code]) {
        setClosedReason(code); // sohbet kapandı: yazma alanı açıklamaya döner
      } else {
        Alert.alert(t('error'), apiErrorMessage(err, t, 'chat_send_error'));
      }
    } finally {
      setSending(false);
    }
  };

  const handleModeration = () => {
    Alert.alert(t('mod_options_title'), `@${username}`, [
      { text: t('mod_report'), onPress: () => openReport('USER', userId) },
      {
        text: t('mod_block'), style: 'destructive',
        onPress: () => confirmBlock(t, userId, () => { publishUserHidden(userId); goBackOrFallback(navigation); }),
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
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
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
        <ChatSkeletonPage />
      ) : (
        <FlatList
          data={inverted}
          inverted
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            // inverted liste empty bileşenini ters çevirir
            loadError ? (
              <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
                <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('load_failed')}</Text>
                <TouchableOpacity
                  onPress={() => { setLoading(true); fetchMessages(); }}
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryText}>{t('retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('chat_empty')}
                </Text>
              </View>
            )
          }
        />
      )}

      {/* Kapalı sohbet: geçmiş okunur, yeni mesaj gönderilemez */}
      {closedReason ? (
        <View style={[styles.closedBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityRole="text">
          <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.closedText, { color: colors.textSecondary }]}>
            {t(CLOSED_REASON_KEYS[closedReason] || 'chat_closed_privacy')}
          </Text>
        </View>
      ) : (
      /* MESAJ YAZMA ALANI: tek hap biçimli kutu, gönder butonu kutunun içinde */
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
      )}
      {reportSheet}
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
    emptyText: { fontSize: 15, textAlign: 'center' },

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
    closedBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1,
    },
    closedText: { flex: 1, fontSize: 13, lineHeight: 18 },
    retryBtn: { marginTop: 14, minHeight: 44, paddingHorizontal: 22, borderRadius: 12, justifyContent: 'center' },
    retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
