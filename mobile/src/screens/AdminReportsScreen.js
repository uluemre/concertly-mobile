import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { dateLocale } from '../utils/time';
import { accountAge } from '../utils/adminOrganizer';

const TYPES = [
  ['all', 'mq_type_all'], ['posts', 'mq_type_posts'], ['comments', 'mq_type_comments'],
  ['community', 'mq_type_community'], ['messages', 'mq_type_messages'], ['users', 'mq_type_users'],
];
const TYPE_ICON = {
  POST: 'document-text-outline', COMMENT: 'chatbubble-outline', COMMUNITY_POST: 'people-outline',
  COMMUNITY_COMMENT: 'chatbubbles-outline', MESSAGE: 'mail-outline', USER: 'person-outline',
};
const ERRORS = {
  CANNOT_BAN_ADMIN: 'adm_user_err_admin',
  OWNER_NOT_FOUND: 'mq_err_owner',
  NOT_HIDEABLE: 'mq_err_not_hideable',
};
const BAN_CHOICES = [1, 7, 30, 0];

/**
 * Moderasyon kuyruğu (Instagram / TikTok inceleme kuyruğu gibi): aynı içeriğe gelen
 * şikâyetler tek kartta; içerik önizlemesi, sahibinin geçmişi ve tek dokunuşla karar.
 * Uzun basınca toplu seçim (uygun / gizle).
 */
export default function AdminReportsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState('open');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const res = await API.get('/admin/moderation/queue', { params: { status, type, sort } });
      setData(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, type, sort]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const keyOf = (c) => `${c.targetType}:${c.targetId}`;
  const selecting = selected.size > 0;
  const toggleSelect = (c) => setSelected(prev => {
    const n = new Set(prev);
    const k = keyOf(c);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const reasonLabel = (code) => {
    const key = `mod_reason_${String(code).toLowerCase()}`;
    return t(key) !== key ? t(key) : code;
  };
  const topReason = (c) => {
    const entries = Object.entries(c.reasons || {}).sort((a, b) => b[1] - a[1]);
    return entries.length ? reasonLabel(entries[0][0]) : '';
  };

  const send = async (c, action, extra = {}) => {
    setBusyKey(keyOf(c));
    try {
      await API.post('/admin/moderation/queue/action', { targetType: c.targetType, targetId: c.targetId, action, ...extra });
      // Kart kuyruktan düşer; sayılar sunucudan tazelenir
      setData(prev => (prev ? { ...prev, items: prev.items.filter(x => keyOf(x) !== keyOf(c)), total: Math.max(0, prev.total - 1) } : prev));
      load();
    } catch (err) {
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), ERRORS[code] ? t(ERRORS[code]) : t('admin_organizer_action_error'));
    } finally {
      setBusyKey(null);
    }
  };

  // Süre seçimi alttan açılan sayfada (Android Alert en fazla 3 düğme gösterir)
  const [banFor, setBanFor] = useState(null); // { card, hide }
  const decideBan = (c, hide) => setBanFor({ card: c, hide });

  const confirmAction = (c, action) => {
    const titles = { DISMISS: 'mq_dismiss_title', HIDE: 'mq_hide_title', HIDE_WARN: 'mq_hide_warn_title', WARN: 'mq_warn_title' };
    Alert.alert(t(titles[action]), t(`${titles[action]}_msg`, { user: c.owner?.username || '?', reason: topReason(c) }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: action === 'DISMISS' ? 'default' : 'destructive', onPress: () => send(c, action, { reason: topReason(c) }) },
    ]);
  };

  const bulk = (action) => {
    const targets = (data?.items || []).filter(c => selected.has(keyOf(c))).map(c => ({ targetType: c.targetType, targetId: c.targetId }));
    Alert.alert(t(action === 'HIDE' ? 'mq_bulk_hide_title' : 'mq_bulk_dismiss_title', { count: targets.length }), t('mq_bulk_msg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: action === 'HIDE' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await API.post('/admin/moderation/queue/bulk', { action, targets });
            setSelected(new Set());
            load();
          } catch {
            Alert.alert(t('error'), t('admin_organizer_action_error'));
          }
        },
      },
    ]);
  };

  const openContext = (c) => {
    if (c.postId) navigation.navigate('PostDetail', { postId: c.postId });
    else if (c.communityId) navigation.navigate('CommunityDetail', { communityId: c.communityId });
    else if (c.targetType === 'USER') navigation.navigate('AdminUserDetail', { id: c.targetId });
  };

  const renderCard = ({ item: c }) => {
    const k = keyOf(c);
    const isSel = selected.has(k);
    const busy = busyKey === k;
    const owner = c.owner;
    const open = status === 'open';
    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onLongPress={() => open && toggleSelect(c)}
        onPress={() => (selecting ? toggleSelect(c) : null)}
        style={[styles.card, isSel && styles.cardSel]}
        accessibilityState={{ selected: isSel }}
      >
        <View style={styles.cardHead}>
          {selecting ? <Ionicons name={isSel ? 'checkbox' : 'square-outline'} size={20} color={isSel ? colors.primary : colors.textSecondary} /> : null}
          <Ionicons name={TYPE_ICON[c.targetType] || 'flag-outline'} size={16} color={colors.textSecondary} />
          <Text style={styles.cardType}>{t(`mq_target_${c.targetType.toLowerCase()}`)}</Text>
          <View style={[styles.countPill, c.count >= 3 && styles.countHot]}>
            <Ionicons name="flag" size={11} color="#fff" />
            <Text style={styles.countText}>{c.count}</Text>
          </View>
          <Text style={styles.when}>{fmt(c.lastAt)}</Text>
        </View>

        <View style={styles.reasons}>
          {Object.entries(c.reasons || {}).map(([code, n]) => (
            <View key={code} style={styles.reason}>
              <Text style={styles.reasonText}>{`${reasonLabel(code)}${n > 1 ? ` ×${n}` : ''}`}</Text>
            </View>
          ))}
          {c.hidden ? <View style={[styles.reason, styles.hiddenTag]}><Text style={[styles.reasonText, { color: colors.primary }]}>{t('adm_user_hidden')}</Text></View> : null}
        </View>

        <TouchableOpacity style={styles.preview} onPress={() => openContext(c)} disabled={selecting} activeOpacity={0.85} accessibilityRole="button">
          {c.imageUrl ? <Image source={{ uri: c.imageUrl }} style={styles.previewImg} contentFit="cover" /> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.previewText} numberOfLines={5}>
              {c.deleted ? t('mq_deleted') : (c.content || (c.imageUrl ? t('adm_user_image_post') : t('admin_reports_no_preview')))}
            </Text>
            {c.communityName ? <Text style={styles.small}>{t('mq_in_community', { name: c.communityName })}</Text> : null}
            {c.targetType === 'MESSAGE' ? <Text style={styles.small}>{t('mq_message_note')}</Text> : null}
          </View>
          {(c.postId || c.communityId || c.targetType === 'USER') && !selecting ? <Ionicons name="open-outline" size={16} color={colors.textSecondary} /> : null}
        </TouchableOpacity>

        {owner ? (
          <TouchableOpacity style={styles.owner} onPress={() => navigation.navigate('AdminUserDetail', { id: owner.id })} disabled={selecting} accessibilityRole="button">
            <View style={styles.ownerAvatar}>
              {owner.profileImageUrl ? <Image source={{ uri: owner.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.ownerLetter}>{owner.username?.charAt(0).toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerName} numberOfLines={1}>{`@${owner.username}`}{owner.isActive === false ? ` · ${t('admin_status_banned')}` : ''}</Text>
              <Text style={styles.small} numberOfLines={1}>
                {[accountAge(owner.createdAt).label(t),
                  owner.warnings > 0 ? t('mq_owner_warnings', { count: owner.warnings }) : null,
                  owner.bans > 0 ? t('mq_owner_bans', { count: owner.bans }) : null,
                  owner.hiddenContent > 0 ? t('mq_owner_hidden', { count: owner.hiddenContent }) : null,
                  owner.openReports > c.count ? t('mq_owner_other_reports', { count: owner.openReports - c.count }) : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}

        {c.reporters?.length ? (
          <Text style={styles.small} numberOfLines={1}>{t('mq_reporters', { names: c.reporters.map(n => `@${n}`).join(', ') })}</Text>
        ) : null}

        {open && !selecting ? (
          busy ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} /> : (
            <View style={styles.actions}>
              <ActionBtn icon="checkmark" label={t('mq_dismiss')} color={colors.accent} onPress={() => confirmAction(c, 'DISMISS')} styles={styles} />
              {c.hideable ? <ActionBtn icon="eye-off-outline" label={t('mq_hide')} color={colors.text} onPress={() => confirmAction(c, 'HIDE')} styles={styles} /> : null}
              {owner && !owner.isAdmin ? (
                <ActionBtn icon="warning-outline" label={c.hideable ? t('mq_hide_warn') : t('adm_user_warn')} color={colors.secondary}
                  onPress={() => confirmAction(c, c.hideable ? 'HIDE_WARN' : 'WARN')} styles={styles} />
              ) : null}
              {owner && !owner.isAdmin && owner.isActive !== false ? (
                <ActionBtn icon="ban-outline" label={c.hideable ? t('mq_hide_ban') : t('adm_user_ban')} color={colors.primary}
                  onPress={() => decideBan(c, c.hideable)} styles={styles} />
              ) : null}
            </View>
          )
        ) : null}

        {!open ? (
          <Text style={styles.resolved}>
            {`${t(`mq_res_${String(c.resolution || 'unknown').toLowerCase()}`)}${c.resolvedBy ? ` · @${c.resolvedBy}` : ''}${c.resolvedAt ? ` · ${fmt(c.resolvedAt)}` : ''}`}
          </Text>
        ) : null}
        {!open && c.hidden && c.hideable ? (
          <TouchableOpacity onPress={() => send(c, 'UNHIDE')} style={styles.unhide} accessibilityRole="button">
            <Ionicons name="eye-outline" size={14} color={colors.primary} />
            <Text style={styles.unhideText}>{t('mq_unhide')}</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  const stats = data?.stats || {};
  const items = data?.items || [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (selecting ? setSelected(new Set()) : goBackOrFallback(navigation, 'Admin'))} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name={selecting ? 'close' : 'arrow-back'} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selecting ? t('mq_selected', { count: selected.size }) : t('admin_reports_title')}</Text>
        <TouchableOpacity onPress={() => setSort(s => (s === 'newest' ? 'most' : 'newest'))} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('mq_sort')}>
          <Ionicons name={sort === 'most' ? 'flame' : 'time-outline'} size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {[[stats.openItems, t('mq_stat_open')], [stats.openReports, t('mq_stat_reports')], [stats.newToday, t('mq_stat_today')], [stats.resolvedToday, t('mq_stat_resolved')]].map(([v, l]) => (
          <View key={l} style={styles.stat}>
            <Text style={styles.statValue}>{v ?? '–'}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{l}</Text>
          </View>
        ))}
      </View>

      <View style={styles.segment}>
        {[['open', t('admin_reports_filter_open')], ['resolved', t('mq_resolved_tab')]].map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => { setSelected(new Set()); setLoading(true); setStatus(key); }} style={[styles.segBtn, status === key && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: status === key }}>
            <Text style={[styles.segText, status === key && styles.segTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TYPES.map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => { setSelected(new Set()); setLoading(true); setType(key); }} style={[styles.chip, type === key && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: type === key }}>
              <Text style={[styles.chipText, type === key && styles.chipTextOn]}>{t(label)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyOf}
          renderItem={renderCard}
          contentContainerStyle={[styles.list, items.length === 0 && styles.emptyContainer, { paddingBottom: insets.bottom + (selecting ? 100 : 24) }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListHeaderComponent={status === 'open' && items.length > 1 && !selecting ? <Text style={styles.hint}>{t('mq_hint')}</Text> : null}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name={error ? 'cloud-offline-outline' : 'shield-checkmark-outline'} size={48} color={error ? colors.textSecondary : colors.accent} />
              <Text style={styles.emptyText}>{error ? t('adm_org_load_error') : status === 'open' ? t('mq_empty_open') : t('mq_empty_resolved')}</Text>
            </View>
          )}
        />
      )}

      {banFor ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setBanFor(null)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setBanFor(null)} accessibilityLabel={t('close')}>
            <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>{t('mq_ban_title', { user: banFor.card.owner?.username || '?' })}</Text>
              <Text style={styles.small}>{t('mq_ban_msg', { reason: topReason(banFor.card) })}</Text>
              {BAN_CHOICES.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.banChoice, d === 0 && { borderColor: colors.primary }]}
                  onPress={() => {
                    const { card, hide } = banFor;
                    setBanFor(null);
                    send(card, hide ? 'HIDE_BAN' : 'BAN', { days: d, reason: topReason(card) });
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.banChoiceText, d === 0 && { color: colors.primary }]}>
                    {d === 0 ? t('adm_user_forever') : t('adm_user_days', { count: d })}
                  </Text>
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}

      {selecting ? (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[styles.bulkBtn, { borderColor: colors.accent }]} onPress={() => bulk('DISMISS')} accessibilityRole="button">
            <Ionicons name="checkmark" size={18} color={colors.accent} />
            <Text style={[styles.bulkText, { color: colors.accent }]}>{t('mq_dismiss')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: colors.text, borderColor: colors.text }]} onPress={() => bulk('HIDE')} accessibilityRole="button">
            <Ionicons name="eye-off-outline" size={18} color={colors.background} />
            <Text style={[styles.bulkText, { color: colors.background }]}>{t('mq_hide')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function ActionBtn({ icon, label, color, onPress, styles }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: `${color}55` }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.actionText, { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
    stat: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 8 },
    statValue: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    statLabel: { fontSize: 10, color: colors.textSecondary },
    segment: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, padding: 4, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
    segOn: { backgroundColor: colors.primary },
    segText: { fontWeight: '700', fontSize: 13, color: colors.textSecondary },
    segTextOn: { color: '#fff' },
    chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6 },
    chipOn: { backgroundColor: colors.text, borderColor: colors.text },
    chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    chipTextOn: { color: colors.background },
    list: { paddingHorizontal: 16, gap: 12 },
    hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
    cardSel: { borderColor: colors.primary, backgroundColor: `${colors.primary}0D` },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardType: { fontSize: 13, fontWeight: '800', color: colors.text },
    countPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.textSecondary, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    countHot: { backgroundColor: colors.primary },
    countText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    when: { marginLeft: 'auto', fontSize: 11, color: colors.textSecondary },
    reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    reason: { borderRadius: 8, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 3 },
    hiddenTag: { backgroundColor: `${colors.primary}14` },
    reasonText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    preview: { flexDirection: 'row', gap: 10, backgroundColor: colors.background, borderRadius: 12, padding: 10 },
    previewImg: { width: 64, height: 64, borderRadius: 8 },
    previewText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    small: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    owner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    ownerAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: `${colors.primary}22`, alignItems: 'center', justifyContent: 'center' },
    ownerLetter: { color: colors.primary, fontWeight: '800' },
    ownerName: { fontSize: 13, fontWeight: '700', color: colors.text },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    actionBtn: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 6 },
    actionText: { fontSize: 12, fontWeight: '800' },
    resolved: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    unhide: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
    unhideText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
    emptyContainer: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
    bulkBar: {
      position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10,
      paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    },
    bulkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
    bulkText: { fontWeight: '800', fontSize: 15 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10 },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
    sheetTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    banChoice: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.background },
    banChoiceText: { fontSize: 15, fontWeight: '700', color: colors.text },
  });
}
