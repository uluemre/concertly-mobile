import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { dateLocale } from '../utils/time';
import { accountAge, openInstagram, openWebsite, orgTypeKey } from '../utils/adminOrganizer';

// Onaydan önce gözle kontrol edilecekler (Meta / Spotify for Artists doğrulaması gibi)
const CHECKS = ['adm_org_check_links', 'adm_org_check_real', 'adm_org_check_name', 'adm_org_check_events'];
// Ret gerekçesi şablonları: başvurana bildirim olarak gider, düzenlenebilir
const REJECT_TEMPLATES = ['adm_org_reject_unverified', 'adm_org_reject_personal', 'adm_org_reject_missing', 'adm_org_reject_inactive'];

/** Tek bir organizatör başvurusunun incelemesi: sinyaller, bağlantılar, kontrol listesi, iç not, karar. */
export default function AdminOrganizerRequestScreen({ navigation, route }) {
  const id = route?.params?.id;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checks, setChecks] = useState(() => new Set());
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const savedNote = useRef('');

  const load = useCallback(async () => {
    try {
      const res = await API.get(`/admin/organizer-requests/${id}`);
      setItem(res.data);
      setNote(res.data?.internalNote || '');
      savedNote.current = res.data?.internalNote || '';
      setNoteSaved(true);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveNote = async () => {
    if (note.trim() === savedNote.current.trim()) { setNoteSaved(true); return; }
    try {
      await API.put(`/admin/organizer-requests/${id}/note`, { note });
      savedNote.current = note;
      setNoteSaved(true);
    } catch {
      Alert.alert(t('error'), t('adm_org_note_failed'));
    }
  };

  const toggleCheck = (key) => setChecks(prev => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const decide = async (approve, rejectNote) => {
    setBusy(true);
    try {
      await saveNote();
      if (approve) await API.post(`/admin/organizer-requests/${id}/approve`);
      else await API.post(`/admin/organizer-requests/${id}/reject`, { note: rejectNote || null });
      setRejectOpen(false);
      Alert.alert(t('success'), approve ? t('adm_org_approved_msg') : t('adm_org_rejected_msg'));
      goBackOrFallback(navigation, 'AdminOrganizerRequests');
    } catch (err) {
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), code === 'REQUEST_ALREADY_REVIEWED' ? t('adm_org_already_reviewed') : t('admin_organizer_action_error'));
      if (code === 'REQUEST_ALREADY_REVIEWED') load();
    } finally {
      setBusy(false);
    }
  };

  const approve = () => {
    const missing = CHECKS.length - checks.size;
    const go = () => decide(true);
    Alert.alert(
      t('adm_org_approve_title'),
      missing > 0 ? t('adm_org_approve_missing', { count: missing }) : t('adm_org_approve_msg', { name: item.organizationName }),
      [{ text: t('cancel'), style: 'cancel' }, { text: t('adm_org_approve'), onPress: go }],
    );
  };

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (error || !item) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.muted}>{t('adm_org_load_error')}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={styles.retry} accessibilityRole="button">
          <Text style={styles.btnText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const age = accountAge(item.accountCreatedAt);
  const pending = item.status === 'PENDING';
  const rejectedBefore = (item.history || []).filter(h => h.status === 'REJECTED').length;
  // Otomatik uyarılar: incelemeci bunlara özellikle baksın
  const warnings = [
    age.days < 7 ? t('adm_org_warn_new', { count: age.days }) : null,
    item.reports > 0 ? t('adm_org_warn_reports', { count: item.reports }) : null,
    !item.emailVerified ? t('adm_org_warn_email') : null,
    rejectedBefore > 0 ? t('adm_org_warn_rejected', { count: rejectedBefore }) : null,
    !item.userActive ? t('adm_org_warn_banned') : null,
    item.concerts === 0 && item.posts === 0 ? t('adm_org_warn_inactive') : null,
  ].filter(Boolean);

  const stat = (icon, value, label, danger) => (
    <View style={[styles.stat, danger && styles.statDanger]} key={label}>
      <Ionicons name={icon} size={16} color={danger ? colors.primary : colors.textSecondary} />
      <Text style={[styles.statValue, danger && { color: colors.primary }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'AdminOrganizerRequests')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('adm_org_review_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (pending ? 110 : 40) }]} keyboardShouldPersistTaps="handled">
        {!pending ? (
          <View style={[styles.banner, item.status === 'APPROVED' ? styles.bannerOk : styles.bannerNo]}>
            <Ionicons name={item.status === 'APPROVED' ? 'checkmark-circle' : 'close-circle'} size={18} color={item.status === 'APPROVED' ? colors.accent : colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>
                {item.status === 'APPROVED' ? t('adm_org_status_approved') : t('adm_org_status_rejected')}
                {item.reviewedBy ? ` · @${item.reviewedBy}` : ''}{item.reviewedAt ? ` · ${fmt(item.reviewedAt)}` : ''}
              </Text>
              {item.reviewNote ? <Text style={styles.muted}>{item.reviewNote}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* Başvuran */}
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('UserProfile', { userId: item.userId })} activeOpacity={0.85} accessibilityRole="button">
          <View style={styles.row}>
            <View style={styles.avatar}>
              {item.profileImageUrl ? <Image source={{ uri: item.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="person" size={24} color={colors.textSecondary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{item.fullName || `@${item.username}`}</Text>
              <Text style={styles.muted}>{`@${item.username} · ${t('adm_org_joined', { age: age.label(t) })}`}</Text>
              <View style={styles.row}>
                <Ionicons name={item.emailVerified ? 'mail' : 'mail-outline'} size={13} color={item.emailVerified ? colors.accent : colors.textSecondary} />
                <Text style={styles.small}>{item.emailVerified ? t('adm_org_email_ok') : t('adm_org_email_no')}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Sinyaller */}
        <View style={styles.stats}>
          {stat('people-outline', item.followers, t('adm_org_sig_followers'))}
          {stat('document-text-outline', item.posts, t('adm_org_sig_posts'))}
          {stat('ticket-outline', item.concerts, t('adm_org_sig_concerts'))}
          {stat('flag-outline', item.reports, t('adm_org_sig_reports'), item.reports > 0)}
        </View>

        {warnings.length ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>{t('adm_org_warn_title')}</Text>
            {warnings.map(w => (
              <View key={w} style={styles.row}>
                <Ionicons name="warning-outline" size={14} color={colors.secondary} />
                <Text style={styles.warnText}>{w}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.warnBox, styles.okBox]}>
            <View style={styles.row}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.accent} />
              <Text style={styles.warnText}>{t('adm_org_no_warnings')}</Text>
            </View>
          </View>
        )}

        {/* Başvuru */}
        <Text style={styles.section}>{t('adm_org_application')}</Text>
        <View style={styles.card}>
          <Text style={styles.title}>{item.organizationName}</Text>
          <Text style={styles.muted}>{`${t(orgTypeKey(item.type))} · ${fmt(item.createdAt)}`}</Text>
          {item.website ? (
            <TouchableOpacity style={styles.link} onPress={() => openWebsite(item.website)} accessibilityRole="link">
              <Ionicons name="globe-outline" size={16} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>{item.website}</Text>
              <Ionicons name="open-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {item.instagram ? (
            <TouchableOpacity style={styles.link} onPress={() => openInstagram(item.instagram)} accessibilityRole="link">
              <Ionicons name="logo-instagram" size={16} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>{item.instagram}</Text>
              <Ionicons name="open-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {item.message ? <Text style={styles.message}>{`“${item.message}”`}</Text> : null}
        </View>

        {/* Kontrol listesi */}
        {pending ? (
          <>
            <Text style={styles.section}>{t('adm_org_checklist', { done: checks.size, total: CHECKS.length })}</Text>
            <View style={styles.card}>
              {CHECKS.map(key => {
                const on = checks.has(key);
                return (
                  <TouchableOpacity key={key} style={styles.check} onPress={() => toggleCheck(key)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.accent : colors.textSecondary} />
                    <Text style={styles.checkText}>{t(key)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        {/* İç not */}
        <Text style={styles.section}>{t('adm_org_internal_note')}</Text>
        <TextInput
          value={note}
          onChangeText={(v) => { setNote(v); setNoteSaved(false); }}
          onBlur={saveNote}
          placeholder={t('adm_org_note_ph')}
          placeholderTextColor={colors.textSecondary}
          style={styles.note}
          multiline
          maxLength={1000}
          accessibilityLabel={t('adm_org_internal_note')}
        />
        <Text style={styles.small}>{noteSaved ? t('adm_org_note_hint') : t('adm_org_note_unsaved')}</Text>

        {/* Önceki başvurular */}
        {item.history?.length ? (
          <>
            <Text style={styles.section}>{t('adm_org_history')}</Text>
            {item.history.map(h => (
              <View key={h.id} style={styles.historyRow}>
                <Ionicons name={h.status === 'APPROVED' ? 'checkmark-circle-outline' : h.status === 'REJECTED' ? 'close-circle-outline' : 'time-outline'} size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyText}>{`${h.organizationName} · ${fmt(h.createdAt)}`}</Text>
                  {h.reviewNote ? <Text style={styles.small}>{h.reviewNote}</Text> : null}
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      {pending ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[styles.decision, styles.reject]} onPress={() => setRejectOpen(true)} disabled={busy} accessibilityRole="button">
            <Ionicons name="close" size={18} color={colors.primary} />
            <Text style={[styles.decisionText, { color: colors.primary }]}>{t('adm_org_reject')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.decision, styles.approve, checks.size < CHECKS.length && styles.approveMuted]} onPress={approve} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
            <Text style={[styles.decisionText, { color: '#fff' }]}>{t('adm_org_approve')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {rejectOpen ? (
        <RejectSheet
          onClose={() => setRejectOpen(false)}
          onSubmit={(n) => decide(false, n)}
          busy={busy}
          styles={styles}
          colors={colors}
          t={t}
        />
      ) : null}
    </View>
  );
}

/** Ret gerekçesi: şablon seç ya da yaz; başvurana bildirim olarak gider */
function RejectSheet({ onClose, onSubmit, busy, styles, colors, t }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} accessibilityLabel={t('close')}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('adm_org_reject_title')}</Text>
          <Text style={styles.small}>{t('adm_org_reject_hint')}</Text>
          <View style={styles.templates}>
            {REJECT_TEMPLATES.map(key => (
              <TouchableOpacity key={key} style={styles.template} onPress={() => setText(t(key))} accessibilityRole="button">
                <Text style={styles.templateText}>{t(key)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('adm_org_reject_ph')}
            placeholderTextColor={colors.textSecondary}
            style={styles.note}
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={[styles.decision, styles.rejectSolid]} onPress={() => onSubmit(text.trim())} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.decisionText, { color: '#fff' }]}>{t('adm_org_reject_send')}</Text>}
          </TouchableOpacity>
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
    btnText: { color: '#fff', fontWeight: '700' },
    content: { padding: 16, gap: 12 },
    muted: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    small: { fontSize: 12, color: colors.textSecondary },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
    avatar: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
    title: { fontSize: 16, fontWeight: '800', color: colors.text },
    banner: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 12 },
    bannerOk: { backgroundColor: `${colors.accent}1A` },
    bannerNo: { backgroundColor: `${colors.primary}14` },
    bannerTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 10 },
    statDanger: { borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}0F` },
    statValue: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    statLabel: { fontSize: 10, color: colors.textSecondary },
    warnBox: { backgroundColor: `${colors.secondary}14`, borderRadius: 14, padding: 12, gap: 6 },
    okBox: { backgroundColor: `${colors.accent}14` },
    warnTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
    warnText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
    section: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginTop: 6, letterSpacing: 0.3 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background, borderRadius: 10, padding: 10, marginTop: 4 },
    linkText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.primary },
    message: { fontSize: 14, color: colors.text, lineHeight: 20, fontStyle: 'italic', marginTop: 4 },
    check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    checkText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 19 },
    note: {
      minHeight: 72, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      backgroundColor: colors.card, color: colors.text, fontSize: 14, padding: 12,
    },
    historyRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
    historyText: { fontSize: 13, color: colors.text },
    bottom: {
      position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10,
      paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    },
    decision: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 14 },
    reject: { borderWidth: 1, borderColor: colors.primary },
    rejectSolid: { backgroundColor: colors.primary, flex: 0, marginTop: 8 },
    approve: { backgroundColor: colors.accent },
    approveMuted: { opacity: 0.75 },
    decisionText: { fontSize: 15, fontWeight: '800' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10 },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
    sheetTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    templates: { gap: 6 },
    template: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.background },
    templateText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  });
}
