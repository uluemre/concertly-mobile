import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Image, AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API, { getErrorMessage } from '../services/api';
import { formatTimeAgo } from '../utils/time';

const AVATAR_GRADIENTS = [
  ['#E94560', '#7C3AED'],
  ['#00D4AA', '#3B82F6'],
  ['#F5A623', '#E94560'],
  ['#7C3AED', '#00D4AA'],
];

export default function ChatListScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await API.get('/messages/conversations');
      setConversations(res.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchConversations();
    const startPolling = () => {
      clearInterval(pollRef.current);
      if (AppState.currentState === 'active') {
        pollRef.current = setInterval(fetchConversations, 8000);
      }
    };
    startPolling();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') startPolling();
      else clearInterval(pollRef.current);
    });
    return () => { clearInterval(pollRef.current); sub.remove(); };
  }, [fetchConversations]));

  const openChat = (c) => {
    navigation.navigate('Chat', {
      userId: c.userId,
      username: c.username,
      profileImageUrl: c.profileImageUrl,
    });
  };

  const renderConversation = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => openChat(item)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={AVATAR_GRADIENTS[item.userId % AVATAR_GRADIENTS.length]}
        style={styles.avatar}
      >
        {item.profileImageUrl ? (
          <Image source={{ uri: item.profileImageUrl }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>{item.username?.charAt(0).toUpperCase()}</Text>
        )}
      </LinearGradient>

      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={[styles.username, { color: colors.text }]}>@{item.username}</Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {formatTimeAgo(item.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[
              styles.preview,
              { color: item.unreadCount > 0 ? colors.text : colors.textSecondary },
              item.unreadCount > 0 && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {item.lastFromMe ? t('messages_you') : ''}{item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('messages_title')}</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t('messages_subtitle')}</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      ) : (error && conversations.length === 0) ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📡</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('load_failed')}</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(null); setLoading(true); fetchConversations(); }} activeOpacity={0.85}>
            <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.buddyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.buddyBtnText}>{t('retry')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => String(item.userId)}
          renderItem={renderConversation}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchConversations(); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('messages_empty_title')}</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{t('messages_empty_sub')}</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('ConcertBuddyMatch')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#E94560', '#7C3AED']}
                  style={styles.buddyBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.buddyBtnText}>{t('messages_find_buddy')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20, gap: 6 },
    backText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    headerTitle: { fontSize: 26, fontWeight: '900' },
    headerSub: { fontSize: 12 },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10,
    },
    avatar: {
      width: 52, height: 52, borderRadius: 26,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    avatarImg: { width: 52, height: 52, borderRadius: 26 },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: '900' },
    rowInfo: { flex: 1 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    username: { fontSize: 15, fontWeight: '800' },
    time: { fontSize: 11 },
    rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    preview: { flex: 1, fontSize: 13 },
    previewUnread: { fontWeight: '700' },
    unreadBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
    },
    unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 19, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    buddyBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
    buddyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
}
