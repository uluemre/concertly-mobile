import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import API from '../services/api';

const TYPE_CONFIG = {
  follow:  { icon: '👤', text: 'seni takip etmeye başladı' },
  like:    { icon: '❤️', text: 'postunu beğendi' },
  comment: { icon: '💬', text: 'postuna yorum yaptı' },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'Az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}s önce`;
  return `${Math.floor(diff / 86400)}g önce`;
}

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchAndMarkRead();
    }, [])
  );

  const fetchAndMarkRead = async () => {
    try {
      const res = await API.get('/notifications');
      setNotifications(res.data);
      await API.patch('/notifications/read-all');
      global.setNotificationBadge?.(0);
    } catch (err) {
      console.log('Bildirim hatası:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (item) => {
    if (item.actorId) {
      navigation.navigate('UserProfile', { userId: item.actorId });
    }
  };

  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.type] || { icon: '🔔', text: 'bir işlem yaptı' };
    const isUnread = !item.isRead;

    return (
      <TouchableOpacity
        style={[styles.row, isUnread && styles.rowUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.75}
      >
        <View style={styles.avatarWrap}>
          {item.actorProfileImageUrl ? (
            <Image source={{ uri: item.actorProfileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{cfg.icon}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.message} numberOfLines={2}>
            <Text style={styles.actor}>@{item.actorUsername}</Text>
            {' '}{cfg.text}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
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
        <Text style={styles.headerTitle}>Bildirimler</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={notifications.length === 0 && styles.emptyContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>Henüz bildirim yok</Text>
            <Text style={styles.emptySub}>Biri seni takip ettiğinde veya postunu beğendiğinde burada görünür</Text>
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
