import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import { hapticLight } from '../utils/haptics';

// Kişisiz (Concertly'nin kendi gönderdiği) bildirimlerde gösterilen logo
const LOGO = require('../../assets/logo-mark.png');

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session, setNotificationCount } = useAuth();
  const { t } = useLanguage();

  // icon: Ionicons adı; tint: tema rengi anahtarı (colors[tint])
  const TYPE_CONFIG = useMemo(() => ({
    follow:         { icon: 'person-add', tint: 'primary', text: t('notif_follow') },
    follow_request:  { icon: 'hand-left', tint: 'secondary', text: t('notif_follow_request') },
    follow_accepted: { icon: 'checkmark-circle', tint: 'accent', text: t('notif_follow_accepted') },
    buddy_match:     { icon: 'people', tint: 'accent', text: t('notif_buddy_match') },
    like:           { icon: 'heart', tint: 'primary', text: t('notif_like') },
    comment:        { icon: 'chatbubble', tint: 'accent', text: t('notif_comment') },
    message:        { icon: 'mail', tint: 'secondary', text: t('notif_message') },
    new_event:      { icon: 'mic', tint: 'primary', text: t('notif_new_event') },
    event_reminder: { icon: 'ticket', tint: 'secondary', text: t('notif_event_reminder') },
    event_cancelled: { icon: 'close-circle', tint: 'primary', text: t('notif_event_cancelled') },
    daily_song:     { icon: 'calendar', tint: 'accent', text: t('notif_daily_song') },
    badge:          { icon: 'ribbon', tint: 'secondary', text: t('notif_default') },
    // Topluluk bildirimleri (A3)
    community_invite:           { icon: 'people', tint: 'accent', text: t('notif_community_invite') },
    community_join_request:     { icon: 'hand-left', tint: 'secondary', text: t('notif_community_join_request') },
    community_request_approved: { icon: 'checkmark-circle', tint: 'accent', text: t('notif_community_request_approved') },
    community_approved:         { icon: 'checkmark-circle', tint: 'accent', text: t('notif_community_approved') },
    community_rejected:         { icon: 'alert-circle', tint: 'secondary', text: t('notif_community_rejected') },
    community_ownership:        { icon: 'star', tint: 'secondary', text: t('notif_community_ownership') },
    community_comment:          { icon: 'chatbubbles', tint: 'accent', text: t('notif_community_comment') },
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
  // Çoklu silme: seçim modu ve seçilen grup anahtarları
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
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
          ids: [n.id],                              // silmede grubun tüm bildirimleri birlikte gider
          count: 1,
          actors: n.actorUsername ? [n.actorUsername] : [],
          isUnread: !n.isRead,
        });
      } else {
        const g = groups[idx];
        g.count += 1;
        g.ids.push(n.id);
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
    const cfg = TYPE_CONFIG[g.type] || { icon: 'notifications', tint: 'textSecondary', text: t('notif_default') };
    // Sistem topluluk bildirimleri tam cümledir; aktör adı yazılmaz (A3)
    if (isCommunityNotification(g.type) && !COMMUNITY_ACTOR_TYPES.includes(g.type)) {
      return { actor: '', text: cfg.text, icon: cfg.icon, tint: cfg.tint };
    }
    if (g.type === 'badge') {
      // Tam cümle; başına aktör adı yazılmaz
      return { actor: '', text: t('notif_badge', { badge: badgeName(g.rep.message) }), icon: cfg.icon, tint: cfg.tint };
    }
    const others = g.actors.length - 1;
    if ((g.type === 'like' || g.type === 'comment' || g.type === 'follow') && others > 0) {
      const key = g.type === 'like' ? 'notif_like_group'
        : g.type === 'comment' ? 'notif_comment_group'
        : 'notif_follow_group';
      return { actor: `@${g.actors[0]}`, text: t(key, { count: others }), icon: cfg.icon, tint: cfg.tint };
    }
    if (g.type === 'message' && g.count > 1) {
      return { actor: `@${g.rep.actorUsername}`, text: t('notif_message_group', { count: g.count }), icon: cfg.icon, tint: cfg.tint };
    }
    return {
      actor: g.rep.actorUsername ? `@${g.rep.actorUsername}` : 'Concertly',
      text: cfg.text,
      icon: cfg.icon,
      tint: cfg.tint,
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
    if (item.type === 'buddy_match') {
      navigation.navigate('ConcertBuddyMatch', { tab: 'matches' });
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

  // ── Silme ────────────────────────────────────────────────────────────────
  // Bildirim listeden hemen düşer; sunucu hata verirse liste yeniden yüklenir.
  const removeIds = async (ids) => {
    if (ids.length === 0) return;
    const drop = new Set(ids);
    setNotifications(prev => prev.filter(n => !drop.has(n.id)));
    try {
      if (ids.length === 1) await API.delete(`/notifications/${ids[0]}`);
      else await API.post('/notifications/delete', { ids });
    } catch (err) {
      Alert.alert(t('error'), t('notif_delete_error'));
      fetchAndMarkRead();
    }
  };

  const confirmDeleteGroup = (g) => {
    hapticLight();
    Alert.alert(t('notif_delete_title'), null, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => removeIds(g.ids) },
    ]);
  };

  const exitSelection = () => { setSelecting(false); setSelected(new Set()); };

  const toggleSelected = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allSelected = grouped.length > 0 && selected.size === grouped.length;
  const selectAllToggle = () => {
    setSelected(allSelected ? new Set() : new Set(grouped.map(g => g.key)));
  };

  const deleteSelected = () => {
    const ids = grouped.filter(g => selected.has(g.key)).flatMap(g => g.ids);
    if (ids.length === 0) return;
    Alert.alert(t('notif_delete_selected_title', { count: selected.size }), null, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          exitSelection();
          if (ids.length === notifications.length) {
            // Hepsi seçildiyse tek istekle tümü
            setNotifications([]);
            try { await API.delete('/notifications'); } catch {
              Alert.alert(t('error'), t('notif_delete_error'));
              fetchAndMarkRead();
            }
          } else {
            removeIds(ids);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item: g }) => {
    const line = getLine(g);
    const rep = g.rep;
    const isUnread = g.isUnread;
    const communityName = isCommunityNotification(g.type) ? communityNameFromMessage(rep.message) : null;
    const time = timeAgo(rep.createdAt);

    return (
      <TouchableOpacity
        style={[styles.row, isUnread && styles.rowUnread, selecting && selected.has(g.key) && styles.rowSelected]}
        onPress={() => (selecting ? toggleSelected(g.key) : handlePress(g))}
        onLongPress={() => (selecting ? toggleSelected(g.key) : confirmDeleteGroup(g))}
        delayLongPress={350}
        activeOpacity={0.75}
        accessibilityRole={selecting ? 'checkbox' : 'button'}
        accessibilityState={selecting ? { checked: selected.has(g.key) } : undefined}
        accessibilityHint={selecting ? undefined : t('notif_long_press_hint')}
        accessibilityLabel={[line.actor, line.text, communityName, time].filter(Boolean).join(', ')}
      >
        {selecting && (
          <Ionicons
            name={selected.has(g.key) ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={selected.has(g.key) ? colors.primary : colors.textSecondary}
            style={styles.checkbox}
          />
        )}
        {/* Avatar ayrıca tıklanır: bildirimi oluşturan kişinin profili */}
        <TouchableOpacity
          style={styles.avatarWrap}
          disabled={!rep.actorId || selecting}
          onPress={() => navigation.navigate('UserProfile', { userId: rep.actorId })}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={rep.actorUsername ? `@${rep.actorUsername}` : undefined}
          accessibilityElementsHidden={!rep.actorId}
          importantForAccessibility={rep.actorId ? 'auto' : 'no-hide-descendants'}
        >
          {rep.actorProfileImageUrl ? (
            <Image source={{ uri: rep.actorProfileImageUrl }} style={styles.avatar} />
          ) : rep.actorUsername ? (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{rep.actorUsername[0].toUpperCase()}</Text>
            </View>
          ) : (
            // Kişisiz (sistem) bildirim: Concertly'nin kendisi — logo
            <Image source={LOGO} style={[styles.avatar, styles.avatarLogo]} accessibilityLabel="Concertly" />
          )}
          <View style={styles.typeBadge}>
            <Ionicons name={line.icon} size={13} color={colors[line.tint] || colors.textSecondary} />
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
          {communityName ? (
            <View style={styles.communityLine}>
              <Ionicons name="people" size={14} color={colors.textSecondary} />
              <Text style={[styles.message, styles.communityName]} numberOfLines={1}>{communityName}</Text>
            </View>
          ) : null}
          <Text style={styles.time}>{time}</Text>
        </View>

        {isUnread && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} accessibilityRole="header">{t('notifications_title')}</Text>
        </View>
        <ListSkeletonPage />
      </View>
    );
  }

  if (error && grouped.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} accessibilityRole="header">{t('notifications_title')}</Text>
        </View>
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={52} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{t('load_failed')}</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity
            onPress={() => { setError(null); setLoading(true); fetchAndMarkRead(); }}
            style={styles.retryBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, styles.headerRow]}>
        <Text style={styles.headerTitle} accessibilityRole="header">{t('notifications_title')}</Text>
        {grouped.length > 0 && (
          <TouchableOpacity
            onPress={() => (selecting ? exitSelection() : setSelecting(true))}
            style={styles.headerAction}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerActionText}>{selecting ? t('cancel') : t('notif_select')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {selecting && (
        <View style={styles.selectionBar}>
          <TouchableOpacity onPress={selectAllToggle} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.selectionLink}>{allSelected ? t('notif_select_none') : t('notif_select_all')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={deleteSelected}
            disabled={selected.size === 0}
            style={[styles.deleteBtn, selected.size === 0 && styles.deleteBtnDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: selected.size === 0 }}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.deleteBtnText}>{t('notif_delete_count', { count: selected.size })}</Text>
          </TouchableOpacity>
        </View>
      )}

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
            <Ionicons name="notifications-outline" size={52} color={colors.textSecondary} style={styles.emptyIcon} />
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
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerAction: { paddingVertical: 6, paddingHorizontal: 4 },
    headerActionText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    selectionBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 12,
    },
    selectionLink: { fontSize: 14, fontWeight: '600', color: colors.primary },
    deleteBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    },
    deleteBtnDisabled: { opacity: 0.4 },
    deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    checkbox: { marginRight: 10 },
    avatarLogo: { backgroundColor: '#0F0F1A' },
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
    rowSelected: { backgroundColor: colors.primary + '14' },
    rowUnread: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '12',
    },

    avatarWrap: { position: 'relative', marginRight: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    avatarPlaceholder: {
      width: 50, height: 50, borderRadius: 25,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: colors.cardAlt,
      borderWidth: 1, borderColor: colors.border,
    },
    avatarSystem: { backgroundColor: colors.primary, borderWidth: 0 },
    avatarInitial: { color: colors.text, fontSize: 20, fontWeight: '900' },
    typeBadge: {
      position: 'absolute', bottom: -2, right: -4,
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: colors.card,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: colors.background,
    },

    body: { flex: 1 },
    message: { fontSize: 14, color: colors.text, lineHeight: 20 },
    actor: { fontWeight: '800', color: colors.text },
    communityLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    communityName: { flexShrink: 1 },
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
    emptyIcon: { marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 8 },
    emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    retryBtn: { marginTop: 18, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
    retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  });
}
