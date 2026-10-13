import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { dateLocale } from '../utils/time';
import { accountAge } from '../utils/adminOrganizer';

const BAN_DAYS = [1, 3, 7, 30, 0]; // 0 = süresiz
const BAN_TEMPLATES = ['adm_user_tpl_spam', 'adm_user_tpl_harass', 'adm_user_tpl_fake', 'adm_user_tpl_content'];
const WARN_TEMPLATES = ['adm_user_tpl_warn_lang', 'adm_user_tpl_warn_spam', 'adm_user_tpl_warn_content'];
const ERRORS = {
  CANNOT_BAN_ADMIN: 'adm_user_err_admin',
  CANNOT_BAN_SELF: 'adm_user_err_self',
  REASON_REQUIRED: 'adm_user_err_reason',
  INVALID_DURATION: 'adm_user_err_duration',
  NOT_BANNED: 'adm_user_err_not_banned',
};
const HISTORY_ICON = { WARN: 'warning', BAN: 'ban', UNBAN: 'checkmark-circle', NOTE: 'document-text' };

/**
 * Admin kullanıcı detayı (Discord / Reddit moderatör araçları gibi): profil, durum, sayılar,
 * moderasyon geçmişi, hakkındaki şikâyetler, son içerikler ve rozetler; uyar / süreli yasak /
 * not / rozet / admin yetkisi.
 */
export default function AdminUserDetailScreen({ navigation, route }) {
  const id = route?.params?.id;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [u, setU] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('history');
  const [sheet, setSheet] = useState(null); // 'ban' | 'warn' | 'note' | 'badge'
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get(`/admin/users/${id}/overview`);
      setU(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso, withTime = true) => (iso ? new Date(iso).toLocaleString(dateLocale(lang), {
    day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }) : '');

  const run = async (request, okKey) => {
    setBusy(true);
    try {
      const res = await request();
      // Yaptırım uçları genel bakışı döner; admin yetkisi uçları farklı biçim döndüğü için yeniden yüklenir
      if (res?.data && Array.isArray(res.data.history)) setU(res.data); else await load();
      setSheet(null);
      if (okKey) Alert.alert(t('success'), t(okKey));
    } catch (err) {
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), ERRORS[code] ? t(ERRORS[code]) : t('admin_organizer_action_error'));
    } finally {
      setBusy(false);
    }
  };

  const reinstate = () => Alert.alert(t('adm_user_reinstate_title'), t('adm_user_reinstate_msg', { user: u.username }), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('adm_user_reinstate'), onPress: () => run(() => API.post(`/admin/users/${id}/reinstate`, {}), 'adm_user_reinstated') },
  ]);

  const toggleAdmin = () => {
    const make = !u.isAdmin;
    Alert.alert(make ? t('admin_action_make_admin') : t('admin_action_remove_admin'), t(make ? 'adm_user_make_admin_msg' : 'adm_user_remove_admin_msg', { user: u.username }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: make ? 'default' : 'destructive', onPress: () => run(() => API.patch(`/admin/users/${id}/${make ? 'make-admin' : 'remove-admin'}`), null) },
    ]);
  };

  const revokeBadge = (b) => Alert.alert(t('adm_user_badge_remove_title'), badgeName(b.code, b.name), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('adm_user_badge_remove'), style: 'destructive', onPress: () => run(() => API.delete(`/admin/users/${id}/badges/${b.code}`), null) },
  ]);

  const badgeName = (code, fallback) => {
    const key = `badge_name_${code}`;
    const name = t(key);
    return name !== key ? name : (fallback || code);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (error || !u) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.muted}>{t('adm_org_load_error')}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const banned = u.isActive === false;
  const openReports = (u.reports || []).filter(r => !r.resolved).length;

  const action = (icon, label, onPress, tint, disabled) => (
    <TouchableOpacity key={label} style={[styles.action, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled || busy} accessibilityRole="button">
      <View style={[styles.actionIcon, { backgroundColor: `${tint}1F` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.actionText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  const stat = (value, label, danger) => (
    <View style={styles.stat} key={label}>
      <Text style={[styles.statValue, danger && { color: colors.primary }]}>{value ?? 0}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );

  const tabs = [
    ['history', t('adm_user_tab_history', { count: (u.history || []).length })],
    ['reports', t('adm_user_tab_reports', { count: (u.reports || []).length })],
    ['content', t('adm_user_tab_content')],
    ['badges', t('adm_user_tab_badges', { count: (u.badges || []).length })],
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'AdminUsers')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>@{u.username}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: u.id })} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('adm_user_open_profile')}>
          <Ionicons name="open-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Profil */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              {u.profileImageUrl ? <Image source={{ uri: u.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.avatarText}>{u.username?.charAt(0).toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{u.fullName || `@${u.username}`}</Text>
              <Text style={styles.muted} numberOfLines={1}>{u.email}</Text>
              <Text style={styles.small} numberOfLines={2}>
                {[u.city, u.age != null ? t('adm_user_age', { count: u.age }) : null, accountAge(u.createdAt).label(t),
                  u.emailVerified ? t('adm_org_email_ok') : t('adm_org_email_no')].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
          <View style={styles.tags}>
            {u.isAdmin ? <Tag text={t('admin_badge_admin')} color={colors.purple} styles={styles} /> : null}
            {u.organizerName ? <Tag text={`${t('org_type_organizer')}: ${u.organizerName}`} color={colors.accent} styles={styles} /> : null}
            {u.privateAccount ? <Tag text={t('adm_user_private')} color={colors.textSecondary} styles={styles} /> : null}
            {u.blockedBy > 0 ? <Tag text={t('adm_user_blocked_by', { count: u.blockedBy })} color={colors.secondary} styles={styles} /> : null}
          </View>
          {u.bio ? <Text style={styles.bio}>{u.bio}</Text> : null}
        </View>

        {banned ? (
          <View style={styles.bannedBox}>
            <Ionicons name="ban" size={18} color={colors.primary} />
            <Text style={styles.bannedText}>
              {u.bannedUntil ? t('adm_user_banned_until', { date: fmt(u.bannedUntil) }) : t('adm_user_banned_forever')}
            </Text>
          </View>
        ) : null}

        {/* Hızlı işlemler */}
        <View style={styles.actions}>
          {action('warning-outline', t('adm_user_warn'), () => setSheet('warn'), colors.secondary)}
          {banned
            ? action('lock-open-outline', t('adm_user_reinstate'), reinstate, colors.accent)
            : action('ban-outline', t('adm_user_ban'), () => setSheet('ban'), colors.primary, u.isAdmin)}
          {action('document-text-outline', t('adm_user_note'), () => setSheet('note'), colors.text)}
          {action('shield-outline', u.isAdmin ? t('adm_user_admin_off') : t('adm_user_admin_on'), toggleAdmin, colors.purple)}
        </View>

        {/* Sayılar */}
        <View style={styles.stats}>
          {stat(u.followers, t('adm_org_sig_followers'))}
          {stat(u.posts, t('adm_org_sig_posts'))}
          {stat(u.comments, t('adm_user_comments'))}
          {stat(u.went, t('org_stat_went'))}
        </View>
        <View style={styles.stats}>
          {stat(u.going, t('org_stat_going'))}
          {stat(u.communities, t('adm_user_communities'))}
          {stat(u.reportsAgainst, t('adm_org_sig_reports'), u.reportsAgainst > 0)}
          {stat(u.reportsFiled, t('adm_user_reports_filed'))}
        </View>

        {/* Sekmeler */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {tab === 'history' ? (
          (u.history || []).length === 0 ? <Text style={styles.empty}>{t('adm_user_no_history')}</Text> : u.history.map(h => (
            <View key={h.id} style={styles.item}>
              <Ionicons name={HISTORY_ICON[h.type] || 'ellipse'} size={18} color={h.type === 'BAN' ? colors.primary : h.type === 'WARN' ? colors.secondary : h.type === 'UNBAN' ? colors.accent : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>
                  {t(`adm_user_hist_${h.type.toLowerCase()}`)}
                  {h.type === 'BAN' ? ` · ${h.untilAt ? t('adm_user_until', { date: fmt(h.untilAt) }) : t('adm_user_forever')}` : ''}
                </Text>
                {h.reason ? <Text style={styles.itemBody}>{h.reason}</Text> : null}
                <Text style={styles.small}>{`@${h.adminName || '?'} · ${fmt(h.createdAt)}`}</Text>
              </View>
            </View>
          ))
        ) : null}

        {tab === 'reports' ? (
          <>
            {openReports > 0 ? <Text style={styles.small}>{t('adm_user_open_reports', { count: openReports })}</Text> : null}
            {(u.reports || []).length === 0 ? <Text style={styles.empty}>{t('adm_user_no_reports')}</Text> : u.reports.map(r => (
              <TouchableOpacity
                key={r.id}
                style={styles.item}
                disabled={r.targetType !== 'POST'}
                onPress={() => navigation.navigate('PostDetail', { postId: r.targetId })}
                accessibilityRole={r.targetType === 'POST' ? 'button' : 'text'}
              >
                <Ionicons name="flag" size={16} color={r.resolved ? colors.textSecondary : colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{`${t(`adm_user_target_${String(r.targetType).toLowerCase()}`)} · ${r.reason || '—'}`}</Text>
                  <Text style={styles.small}>{`@${r.reporter || '?'} · ${fmt(r.createdAt)}${r.resolved ? ` · ${t('adm_user_resolved')}` : ''}`}</Text>
                </View>
                {r.targetType === 'POST' ? <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} /> : null}
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {tab === 'content' ? (
          <>
            <Text style={styles.sectionLabel}>{t('adm_user_recent_posts')}</Text>
            {(u.recentPosts || []).length === 0 ? <Text style={styles.empty}>{t('adm_user_no_posts')}</Text> : u.recentPosts.map(p => (
              <TouchableOpacity key={p.id} style={styles.item} onPress={() => navigation.navigate('PostDetail', { postId: p.id })} accessibilityRole="button">
                {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.thumb} contentFit="cover" /> : <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemBody} numberOfLines={2}>{p.content || t('adm_user_image_post')}</Text>
                  <Text style={styles.small}>{`♥ ${p.likes} · 💬 ${p.comments} · ${fmt(p.createdAt, false)}${p.hidden ? ` · ${t('adm_user_hidden')}` : ''}`}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <Text style={styles.sectionLabel}>{t('adm_user_recent_comments')}</Text>
            {(u.recentComments || []).length === 0 ? <Text style={styles.empty}>{t('adm_user_no_comments')}</Text> : u.recentComments.map(c => (
              <TouchableOpacity key={c.id} style={styles.item} onPress={() => navigation.navigate('PostDetail', { postId: c.postId })} accessibilityRole="button">
                <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemBody} numberOfLines={2}>{c.content}</Text>
                  <Text style={styles.small}>{`${fmt(c.createdAt, false)}${c.hidden ? ` · ${t('adm_user_hidden')}` : ''}`}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {tab === 'badges' ? (
          <>
            <TouchableOpacity style={styles.addBadge} onPress={() => setSheet('badge')} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addBadgeText}>{t('adm_user_badge_give')}</Text>
            </TouchableOpacity>
            {(u.badges || []).length === 0 ? <Text style={styles.empty}>{t('adm_user_no_badges')}</Text> : u.badges.map(b => (
              <View key={b.code} style={styles.item}>
                <Text style={styles.badgeIcon}>{b.icon || '🏅'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{badgeName(b.code, b.name)}</Text>
                  <Text style={styles.small}>{fmt(b.earnedAt, false)}</Text>
                </View>
                <TouchableOpacity onPress={() => revokeBadge(b)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('adm_user_badge_remove')}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      {sheet === 'ban' || sheet === 'warn' || sheet === 'note' ? (
        <ActionSheet
          kind={sheet}
          user={u.username}
          busy={busy}
          onClose={() => setSheet(null)}
          onSubmit={(text, days) => {
            if (sheet === 'ban') run(() => API.post(`/admin/users/${id}/suspend`, { reason: text, days }), 'adm_user_banned_ok');
            else if (sheet === 'warn') run(() => API.post(`/admin/users/${id}/warn`, { reason: text }), 'adm_user_warned_ok');
            else run(() => API.post(`/admin/users/${id}/notes`, { text }), null);
          }}
          styles={styles}
          colors={colors}
          t={t}
        />
      ) : null}
      {sheet === 'badge' ? (
        <BadgeSheet
          owned={new Set((u.badges || []).map(b => b.code))}
          badgeName={badgeName}
          onClose={() => setSheet(null)}
          onPick={(code) => run(() => API.post(`/admin/users/${id}/badges/${code}`), null)}
          styles={styles}
          colors={colors}
          t={t}
        />
      ) : null}
    </View>
  );
}

function Tag({ text, color, styles }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}1F` }]}>
      <Text style={[styles.tagText, { color }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/** Yasak / uyarı / not: şablonlar, (yasakta) süre seçimi ve gerekçe */
function ActionSheet({ kind, user, busy, onClose, onSubmit, styles, colors, t }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [days, setDays] = useState(7);
  const templates = kind === 'ban' ? BAN_TEMPLATES : kind === 'warn' ? WARN_TEMPLATES : [];
  const titleKey = kind === 'ban' ? 'adm_user_ban_title' : kind === 'warn' ? 'adm_user_warn_title' : 'adm_user_note_title';
  const hintKey = kind === 'ban' ? 'adm_user_ban_hint' : kind === 'warn' ? 'adm_user_warn_hint' : 'adm_user_note_hint';
  const submitKey = kind === 'ban' ? 'adm_user_ban_submit' : kind === 'warn' ? 'adm_user_warn_submit' : 'adm_user_note_submit';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} accessibilityLabel={t('close')}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t(titleKey, { user })}</Text>
          <Text style={styles.small}>{t(hintKey)}</Text>
          {kind === 'ban' ? (
            <View style={styles.days}>
              {BAN_DAYS.map(d => (
                <TouchableOpacity key={d} onPress={() => setDays(d)} style={[styles.day, days === d && styles.dayOn]} accessibilityRole="radio" accessibilityState={{ checked: days === d }}>
                  <Text style={[styles.dayText, days === d && styles.dayTextOn]}>{d === 0 ? t('adm_user_forever') : t('adm_user_days', { count: d })}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {templates.map(key => (
            <TouchableOpacity key={key} style={styles.template} onPress={() => setText(t(key))} accessibilityRole="button">
              <Text style={styles.templateText}>{t(key)}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('adm_user_reason_ph')}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.submit, { backgroundColor: kind === 'ban' ? colors.primary : kind === 'warn' ? colors.secondary : colors.text }, (!text.trim() || busy) && { opacity: 0.5 }]}
            onPress={() => onSubmit(text.trim(), kind === 'ban' ? days : undefined)}
            disabled={!text.trim() || busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.submitText, kind === 'note' && { color: colors.background }]}>{t(submitKey)}</Text>}
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/** Verilebilecek rozetler (sahip olunanlar hariç) */
function BadgeSheet({ owned, badgeName, onClose, onPick, styles, colors, t }) {
  const insets = useSafeAreaInsets();
  const [badges, setBadges] = useState(null);
  useEffect(() => {
    API.get('/admin/badges').then(res => setBadges(res.data || [])).catch(() => setBadges([]));
  }, []);
  const available = (badges || []).filter(b => !owned.has(b.code));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} accessibilityLabel={t('close')}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: '75%' }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('adm_user_badge_give')}</Text>
          {badges === null ? <ActivityIndicator color={colors.primary} /> : (
            <ScrollView>
              {available.length === 0 ? <Text style={styles.empty}>{t('adm_user_badge_all_owned')}</Text> : available.map(b => (
                <TouchableOpacity key={b.code} style={styles.item} onPress={() => onPick(b.code)} accessibilityRole="button">
                  <Text style={styles.badgeIcon}>{b.icon || '🏅'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{badgeName(b.code, b.name)}</Text>
                    {b.description ? <Text style={styles.small} numberOfLines={2}>{b.description}</Text> : null}
                  </View>
                  <Ionicons name="add" size={20} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    retry: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
    retryText: { color: '#fff', fontWeight: '700' },
    content: { padding: 16, gap: 12 },
    muted: { fontSize: 13, color: colors.textSecondary },
    small: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
    avatar: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: `${colors.primary}22`, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.primary, fontFamily: fonts.headingBold, fontSize: 24 },
    title: { fontSize: 17, fontWeight: '800', color: colors.text },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: '100%' },
    tagText: { fontSize: 11, fontWeight: '800' },
    bio: { fontSize: 13, color: colors.text, lineHeight: 18 },
    bannedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${colors.primary}14`, borderRadius: 12, padding: 12 },
    bannedText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
    actions: { flexDirection: 'row', gap: 8 },
    action: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 10 },
    actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    actionText: { fontSize: 11, fontWeight: '700', color: colors.text },
    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 8 },
    statValue: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.text },
    statLabel: { fontSize: 10, color: colors.textSecondary },
    tabs: { gap: 8, paddingVertical: 2 },
    tab: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 7 },
    tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    tabTextOn: { color: '#fff' },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
    itemTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    itemBody: { fontSize: 13, color: colors.text, lineHeight: 18, marginTop: 2 },
    thumb: { width: 40, height: 40, borderRadius: 8 },
    sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginTop: 4 },
    empty: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
    addBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, paddingVertical: 10 },
    addBadgeText: { color: colors.primary, fontWeight: '700' },
    badgeIcon: { fontSize: 22 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10 },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
    sheetTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    day: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.background },
    dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    dayTextOn: { color: '#fff' },
    template: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.background },
    templateText: { fontSize: 13, color: colors.text, lineHeight: 18 },
    input: { minHeight: 72, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, color: colors.text, fontSize: 14, padding: 12 },
    submit: { borderRadius: 14, alignItems: 'center', paddingVertical: 14 },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
}
