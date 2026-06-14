import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session, setNotificationCount } = useAuth();
  const { t } = useLanguage();

  const TYPE_CONFIG = useMemo(() => ({
    follow:         { icon: '👤', text: t('notif_follow') },
    like:           { icon: '❤️', text: t('notif_like') },
    comment:        { icon: '💬', text: t('notif_comment') },
    message:        { icon: '✉️', text: t('notif_message') },
    new_event:      { icon: '🎤', text: t('notif_new_event') },
    event_reminder: { icon: '🎫', text: t('notif_event_reminder') },
    daily_song:     { icon: '📅', text: t('notif_daily_song') },
  }), [t]);

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return t('notif_just_now');
    if (diff < 3600) return `${Math.floor(diff / 60)}${t('notif_min_ago')}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${t('notif_hour_ago')}`;
    return `${Math.floor(diff / 86400)}${t('notif_day_ago')}`;
  };
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // Aynı türden bildirimleri grupla: aynı gönderiye beğeni/yorum, aynı kişiden mesaj, takipler
  const grouped = useMemo(() => {
    const groups = [];
    const indexByKey = {};
    for (const n of notifications) {
      let key;
      if (n.type === 'like' || n.type === 'comment') key = `${n.type}:${n.entityId}`;
      else if (n.type === 'message') key = `message:${n.actorId}`;
      else if (n.type === 'follow') key = 'follow';
      else key = `single:${n.id}`;

      const idx = indexByKey[key];
      if (idx === undefined) {
        indexByKey[key] = groups.length;
        groups.push({
          key,
          type: n.type,
          rep: n,                                   // en yeni (liste tarihe göre azalan sıralı)
          count: 1,
          actors: n.actorUsername ? [n.actorUsername] : [],
          isUnread: !n.isRead,
        });
      } else {
        const g = groups[idx];
        g.count += 1;
        if (n.actorUsername && !g.actors.includes(n.actorUsername)) g.actors.push(n.actorUsername);
        if (!n.isRead) g.isUnread = true;
      }
    }
    return groups;
  }, [notifications]);

  // Bir grup için aktör etiketi + metin (1'den fazlaysa grup metni)
  const getLine = (g) => {
    const cfg = TYPE_CONFIG[g.type] || { icon: '🔔', text: t('notif_default') };
    const others = g.actors.length - 1;
    if ((g.type === 'like' || g.type === 'comment' || g.type === 'follow') && others > 0) {
      const key = g.type === 'like' ? 'notif_like_group'
        : g.type === 'comment' ? 'notif_comment_group'
        : 'notif_follow_group';
      return { actor: `@${g.actors[0]}`, text: t(key, { count: others }), icon: cfg.icon };
    }
    if (g.type === 'message' && g.count > 1) {
      return { actor: `@${g.rep.actorUsername}`, text: t('notif_message_group', { count: g.count }), icon: cfg.icon };
    }
    return {
      actor: g.rep.actorUsername ? `@${g.rep.actorUsername}` : 'Concertly',
      text: cfg.text,
      icon: cfg.icon,
    };
  };

  useFocusEffect(
    useCallback(() => {
      fetchAndMarkRead();
    }, [])
  );

  const fetchAndMarkRead = async () => {
    try {
      const res = await API.get('/notifications');
      if (!isMounted.current) return;
      setNotifications(res.data);
      await API.patch('/notifications/read-all');
      if (isMounted.current) setNotificationCount(0);
    } catch (err) {
      if (isMounted.current) console.log('Bildirim hatası:', err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handlePress = async (g) => {
    // Gruplu takip (1'den fazla kişi) → tek profil yerine kendi takipçi listene
    if (g.type === 'follow' && g.actors.length > 1) {
      navigation.navigate('FollowList', { userId: session.userId, type: 'followers' });
      return;
    }
    const item = g.rep;
    if (item.type === 'message' && item.actorId) {
      navigation.navigate('Chat', {
        userId: item.actorId,
        username: item.actorUsername,
        profileImageUrl: item.actorProfileImageUrl,
      });
      return;
    }
    if (item.type === 'daily_song') {
      navigation.navigate('DailySong');
      return;
    }
    // Etkinlik bildirimleri (turne duyurusu, hatırlatma) → etkinlik detayına git
    if (item.entityType === 'event' && item.entityId) {
      try {
        const res = await API.get(`/events/${item.entityId}`);
        navigation.navigate('EventDetail', { event: res.data });
      } catch {}
      return;
    }
    if (item.actorId) {
      navigation.navigate('UserProfile', { userId: item.actorId });
    }
  };

  const renderItem = ({ item: g }) => {
    const line = getLine(g);
    const rep = g.rep;
    const isUnread = g.isUnread;

    return (
      <TouchableOpacity
        style={[styles.row, isUnread && styles.rowUnread]}
        onPress={() => handlePress(g)}
        activeOpacity={0.75}
      >
        <View style={styles.avatarWrap}>
          {rep.actorProfileImageUrl ? (
            <Image source={{ uri: rep.actorProfileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarEmoji}>{rep.actorUsername ? '👤' : '🎵'}</Text>
            </View>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{line.icon}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.message} numberOfLines={2}>
            <Text style={styles.actor}>{line.actor}</Text>
            {' '}{line.text}
          </Text>
          {g.count === 1 && rep.message ? (
            <Text style={styles.message} numberOfLines={1}>{rep.message}</Text>
          ) : null}
          <Text style={styles.time}>{timeAgo(rep.createdAt)}</Text>
        </View>

        {isUnread && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('notifications_title')}</Text>
      </View>

      <FlatList
        data={grouped}
        keyExtractor={g => g.key}
        renderItem={renderItem}
        contentContainerStyle={grouped.length === 0 && styles.emptyContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>{t('notifications_empty')}</Text>
            <Text style={styles.emptySub}>{t('notifications_empty_sub')}</Text>
          </View>
        }
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

    header: {
      paddingTop: 56,
      paddingBottom: 14,
      paddingHorizontal: 20,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.background,
    },
    rowUnread: {
      backgroundColor: colors.card,
    },

    avatarWrap: { position: 'relative', marginRight: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    avatarPlaceholder: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarEmoji: { fontSize: 22 },
    typeBadge: {
      position: 'absolute', bottom: -2, right: -4,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.background,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1.5, borderColor: colors.border,
    },
    typeBadgeText: { fontSize: 11 },

    body: { flex: 1 },
    message: { fontSize: 14, color: colors.text, lineHeight: 20 },
    actor: { fontWeight: '700', color: colors.text },
    time: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },

    dot: {
      width: 9, height: 9, borderRadius: 5,
      backgroundColor: colors.primary,
      marginLeft: 8,
    },

    separator: { height: 1, backgroundColor: colors.border },
    emptyContainer: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, paddingHorizontal: 40 },
    emptyEmoji: { fontSize: 52, marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 8 },
    emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  });
}
