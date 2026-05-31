import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { formatTimeAgo } from '../../utils/time';

const ACCENT_COLORS = ['#E94560', '#7C3AED', '#F5A623', '#00D4AA', '#FF6B6B', '#4ECDC4'];

export default React.memo(function HomePostCard({ item, index, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <TouchableOpacity onPress={() => navigation.navigate('FeedTab')} activeOpacity={0.8} style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: accent + '28', borderColor: accent + '50' }]}>
            <Text style={{ color: accent, fontWeight: '800', fontSize: 15 }}>
              {item.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>@{item.username}</Text>
            <Text style={styles.event} numberOfLines={1}>🎵 {item.eventName}</Text>
          </View>
          <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.content} numberOfLines={3}>{item.content}</Text>
        <View style={styles.footer}>
          <Text style={styles.stat}>❤️ {item.likeCount ?? 0}</Text>
          <Text style={styles.stat}>💬 {item.commentCount ?? 0}</Text>
          <View style={styles.dot} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

function createStyles(colors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row', backgroundColor: colors.card,
      borderRadius: 16, marginBottom: 10, overflow: 'hidden',
      borderWidth: 1, borderColor: colors.border,
    },
    accentBar: { width: 3 },
    inner: { flex: 1, padding: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatar: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    username: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 2 },
    event: { fontSize: 11, color: colors.textSecondary },
    time: { fontSize: 11, color: colors.textSecondary },
    content: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 12, opacity: 0.75 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stat: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    dot: { marginLeft: 'auto', width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  });
}
