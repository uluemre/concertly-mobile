import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { ListSkeletonPage } from '../components/SkeletonLoader';
import API, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  isCommunityNotification, COMMUNITY_ACTOR_TYPES, communityNameFromMessage, communityRoute,
} from '../utils/communityNotifications';
import { parseEventDate } from '../utils/time';
import { openEvent } from '../navigation/navHelpers';

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session, setNotificationCount } = useAuth();
  const { t } = useLanguage();

  const TYPE_CONFIG = useMemo(() => ({
    follow:         { icon: '👤', text: t('notif_follow') },
    follow_request:  { icon: '🙋', text: t('notif_follow_request') },
    follow_accepted: { icon: '✅', text: t('notif_follow_accepted') },
    like:           { icon: '❤️', text: t('notif_like') },
    comment:        { icon: '💬', text: t('notif_comment') },
    message:        { icon: '✉️', text: t('notif_message') },
    new_event:      { icon: '🎤', text: t('notif_new_event') },
    event_reminder: { icon: '🎫', text: t('notif_event_reminder') },
    daily_song:     { icon: '📅', text: t('notif_daily_song') },
    badge:          { icon: '🏅', text: t('notif_default') },
    // Topluluk bildirimleri (A3)
    community_invite:           { icon: '👥', text: t('notif_community_invite') },
    community_join_request:     { icon: '🙋', text: t('notif_community_join_request') },
    community_request_approved: { icon: '✅', text: t('notif_community_request_approved') },
    community_approved:         { icon: '✅', text: t('notif_community_approved') },
    community_rejected:         { icon: '⚠️', text: t('notif_community_rejected') },
    community_ownership:        { icon: '👑', text: t('notif_community_ownership') },
    community_comment:          { icon: '💬', text: t('notif_community_comment') },
  }), [t]);

  // Rozet bildirimi (N-38): mesaj alanı rozet kodunu taşır, ad dile göre çevrilir
  const badgeName = (code) => {
    const key = `badge_name_${code}`;
    const name = t(key);
    return name !== key ? name : (code || '');
  };

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return t('notif_just_now');
    if (diff < 3600) return `${Math.floor(diff / 60)}${t('notif_min_ago')}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${t('notif_hour_ago')}`;
    return `${Math.floor(diff / 86400)}${t('notif_day_ago')}`;
  };
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Zaman bölümleri: 16 saat önceki ile 3 ay önceki bildirim ayrımsız alt alta durmasın
  const sections = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = startOfToday - 6 * 86400000;
    const buckets = { today: [], week: [], earlier: [] };
    for (const g of grouped) {
      const ts = parseEventDate(g.rep.createdAt).getTime();
      if (ts >= startOfToday) buckets.today.push(g);
      else if (ts >= weekAgo) buckets.week.push(g);
      else buckets.earlier.push(g);
    }
    return [
      { key: 'today', title: t('notif_section_today'), data: buckets.today },
      { key: 'week', title: t('notif_section_week'), data: buckets.week },
      { key: 'earlier', title: t('notif_section_earlier'), data: buckets.earlier },
    ].filter(s => s.data.length > 0);
  }, [grouped, t]);

  // Bir grup için aktör etiketi + metin (1'den fazlaysa grup metni)
  const getLine = (g) => {
    const cfg = TYPE_CONFIG[g.type] || { icon: '🔔', text: t('notif_default') };
    // Sistem topluluk bildirimleri tam cümledir; aktör adı yazılmaz (A3)
    if (isCommunityNotification(g.type) && !COMMUNITY_ACTOR_TYPES.includes(g.type)) {
      return { actor: '', text: cfg.text, icon: cfg.icon };
    }
    if (g.type === 'badge') {
      // Tam cümle; başına aktör adı yazılmaz
      return { actor: '', text: t('notif_badge', { badge: badgeName(g.rep.message) }), icon: cfg.icon };
    }
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
      setError(null);
      await API.patch('/notifications/read-all');
      if (isMounted.current) setNotificationCount(0);
    } catch (err) {
      if (isMounted.current) setError(getErrorMessage(err));
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
    // Takip isteği → istekler ekranı; kabul → kabul eden kişinin profili (push ile aynı kural)
    if (item.type === 'follow_request') {
      navigation.navigate('FollowRequests');
      return;
    }
    if (item.type === 'follow_accepted' && item.actorId) {
      navigation.navigate('UserProfile', { userId: item.actorId });
      return;
    }
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
    // Topluluk bildirimleri → topluluk detayı; katılma isteği → yönetim ekranı (A3)
    if (isCommunityNotification(item.type)) {
      const route = communityRoute(item.type, item.entityId);
      if (route) navigation.navigate(route.screen, route.params);
      return;
    }
    // Rozet bildirimi → Profil > Rozetler (N-38)
    if (item.type === 'badge') {
      navigation.navigate('Profile', { tab: 'badges' });
      return;
    }
    // Etkinlik bildirimleri (turne duyurusu, hatırlatma) → etkinlik detayına git
    if (item.entityType === 'event' && item.entityId) {
      // Yalnızca id: sayfa etkinliği kendisi çeker, silinmişse "bulunamadı" gösterir
      openEvent(navigation, item.entityId);
      return;
    }
    // Beğeni / yorum bildirimi → ilgili gönderi (silinmişse PostDetail "bulunamadı" gösterir)
    if (item.entityType === 'post' && item.entityId) {
      navigation.navigate('PostDetail', { postId: item.entityId });
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
        {/* Avatar ayrıca tıklanır: bildirimi oluşturan kişinin profili */}
        <TouchableOpacity
          style={styles.avatarWrap}
          disabled={!rep.actorId}
          onPress={() => navigation.navigate('UserProfile', { userId: rep.actorId })}
          activeOpacity={0.75}
        >
          {rep.actorProfileImageUrl ? (
            <Image source={{ uri: rep.actorProfileImageUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={rep.actorUsername ? ['#7C3AED', '#E94560'] : ['#E94560', '#F5A623']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.avatarPlaceholder}
            >
              {rep.actorUsername
                ? <Text style={styles.avatarInitial}>{rep.actorUsername[0].toUpperCase()}</Text>
                : <Ionicons name="musical-notes" size={22} color="#fff" />}
            </LinearGradient>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{line.icon}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.body}>
          <Text style={styles.message} numberOfLines={2}>
            {line.actor ? <Text style={styles.actor}>{line.actor}</Text> : null}
            {line.actor ? ' ' : ''}{line.text}
          </Text>
          {g.count === 1 && rep.message && g.type !== 'badge' && !isCommunityNotification(g.type) ? (
            <Text style={styles.message} numberOfLines={1}>{rep.message}</Text>
          ) : null}
          {/* Topluluk bildiriminde ham Türkçe sunucu cümlesi yerine yalnızca topluluk adı */}
          {isCommunityNotification(g.type) && communityNameFromMessage(rep.message) ? (
            <Text style={styles.message} numberOfLines={1}>👥 {communityNameFromMessage(rep.message)}</Text>
          ) : null}
          <Text style={styles.time}>{timeAgo(rep.createdAt)}</Text>
        </View>

        {isUnread && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={colors.headerGradient} style={styles.header}>
          <Text style={styles.headerTitle}>{t('notifications_title')}</Text>
        </LinearGradient>
        <ListSkeletonPage />
      </View>
    );
  }

  if (error && grouped.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={colors.headerGradient} style={styles.header}>
          <Text style={styles.headerTitle}>{t('notifications_title')}</Text>
        </LinearGradient>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📡</Text>
          <Text style={styles.emptyTitle}>{t('load_failed')}</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity
            onPress={() => { setError(null); setLoading(true); fetchAndMarkRead(); }}
            style={styles.retryBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <Text style={styles.headerTitle}>{t('notifications_title')}</Text>
      </LinearGradient>

      <SectionList
        sections={sections}
        keyExtractor={g => g.key}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={grouped.length === 0 ? styles.emptyContainer : styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={11}
        removeClippedSubviews
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

    header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
    headerTitle: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: 0.2 },
    listContent: { paddingHorizontal: 16, paddingBottom: 32 },

    // Kart satırlar: okunmamış bildirim renkli kenarlık ve hafif vurguyla öne çıkar
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    rowUnread: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '12',
    },

    avatarWrap: { position: 'relative', marginRight: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    avatarPlaceholder: {
      width: 50, height: 50, borderRadius: 25,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarInitial: { color: '#fff', fontSize: 20, fontWeight: '900' },
    typeBadge: {
      position: 'absolute', bottom: -2, right: -4,
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: colors.card,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: colors.background,
    },
    typeBadgeText: { fontSize: 11 },

    body: { flex: 1 },
    message: { fontSize: 14, color: colors.text, lineHeight: 20 },
    actor: { fontWeight: '800', color: colors.text },
    time: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontWeight: '600' },

    dot: {
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: colors.primary,
      marginLeft: 8,
    },

    separator: { height: 10 },
    sectionHeader: {
      fontSize: 12, fontWeight: '900', color: colors.textSecondary,
      letterSpacing: 1.2, textTransform: 'uppercase',
      paddingHorizontal: 4, paddingTop: 18, paddingBottom: 10,
    },
    emptyContainer: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, paddingHorizontal: 40 },
    emptyEmoji: { fontSize: 52, marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 8 },
    emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    retryBtn: { marginTop: 18, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
    retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  });
}
