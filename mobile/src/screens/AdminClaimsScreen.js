import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Modal, TextInput, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import API from '../services/api';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { dateLocale, parseEventDate } from '../utils/time';
import { openInstagram, openWebsite } from '../utils/adminOrganizer';

const STATUSES = [['PENDING', 'adm_org_status_pending'], ['APPROVED', 'adm_org_status_approved'], ['REJECTED', 'adm_org_status_rejected']];
const REJECT_TEMPLATES = ['acl_tpl_unverified', 'acl_tpl_other_org', 'acl_tpl_wrong_event'];

/** Admin: "bu etkinlik benim" talepleri; onaylanınca etkinlik organizatörün paneline geçer. */
export default function AdminClaimsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await API.get('/admin/claims', { params: { status } });
      setItems(res.data || []);
    } catch {
      Alert.alert(t('error'), t('adm_org_load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fmt = (iso) => (iso ? parseEventDate(iso).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  const decide = async (c, approve, rejectNote) => {
    setBusyId(c.id);
    try {
      if (approve) await API.post(`/admin/claims/${c.id}/approve`);
      else await API.post(`/admin/claims/${c.id}/reject`, { note: rejectNote || null });
      setRejecting(null);
      setNote('');
      setItems(prev => prev.filter(x => x.id !== c.id));
    } catch (err) {
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), code === 'EVENT_HAS_ORGANIZER' ? t('acl_err_has_org') : code === 'CLAIM_ALREADY_REVIEWED' ? t('adm_org_already_reviewed') : t('admin_organizer_action_error'));
      load();
    } finally {
      setBusyId(null);
    }
  };

  const approve = (c) => Alert.alert(t('acl_approve_title'), t('acl_approve_msg', { org: c.organizerName, event: c.eventName }), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('adm_org_approve'), onPress: () => decide(c, true) },
  ]);

  const renderItem = ({ item: c }) => (
    <View style={styles.card}>
      <TouchableOpacity style={styles.event} onPress={() => openEvent(navigation, c.eventId)} accessibilityRole="button">
        <View style={styles.img}>
          {c.imageUrl ? <Image source={{ uri: c.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="musical-notes" size={18} color={colors.textSecondary} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{c.eventName}</Text>
          <Text style={styles.small} numberOfLines={1}>{[fmt(c.eventDate), c.venueName, c.venueCity].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.small}>{t('acl_source', { source: c.source || '—' })}</Text>
        </View>
        <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.org} onPress={() => navigation.navigate('AdminOrganizerDetail', { id: c.organizerId })} accessibilityRole="button">
        <Ionicons name="business-outline" size={16} color={colors.primary} />
        <Text style={styles.orgName} numberOfLines={1}>
          {c.organizerName}{c.organizerVerified ? ' ✓' : ''}{c.organizerActive === false ? ` · ${t('adm_org_suspended')}` : ''}
        </Text>
        <Text style={styles.small}>{t('adm_org_events_n', { count: c.organizerEvents })}</Text>
      </TouchableOpacity>
      <View style={styles.links}>
        {c.organizerWebsite ? <TouchableOpacity onPress={() => openWebsite(c.organizerWebsite)} accessibilityRole="link"><Text style={styles.link}>{c.organizerWebsite}</Text></TouchableOpacity> : null}
        {c.organizerInstagram ? <TouchableOpacity onPress={() => openInstagram(c.organizerInstagram)} accessibilityRole="link"><Text style={styles.link}>{c.organizerInstagram}</Text></TouchableOpacity> : null}
        {c.sourceUrl ? <TouchableOpacity onPress={() => Linking.openURL(c.sourceUrl).catch(() => {})} accessibilityRole="link"><Text style={styles.link} numberOfLines={1}>{t('acl_ticket_page')}</Text></TouchableOpacity> : null}
      </View>
      {c.message ? <Text style={styles.message}>{`“${c.message}”`}</Text> : null}
      {c.currentOrganizerId && status === 'PENDING' ? <Text style={styles.warn}>{t('acl_err_has_org')}</Text> : null}

      {status === 'PENDING' ? (
        busyId === c.id ? <ActivityIndicator color={colors.primary} /> : (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => setRejecting(c)} accessibilityRole="button">
              <Ionicons name="close" size={16} color={colors.primary} />
              <Text style={[styles.btnText, { color: colors.primary }]}>{t('adm_org_reject')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.approve]} onPress={() => approve(c)} accessibilityRole="button">
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={[styles.btnText, { color: '#fff' }]}>{t('adm_org_approve')}</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <Text style={styles.small}>{[c.reviewedBy ? `@${c.reviewedBy}` : null, c.reviewNote].filter(Boolean).join(' · ')}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('acl_title')}</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.chips}>
        {STATUSES.map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => { setLoading(true); setStatus(key); }} style={[styles.chip, status === key && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: status === key }}>
            <Text style={[styles.chipText, status === key && styles.chipTextOn]}>{t(label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View> : (
        <FlatList
          data={items}
          keyExtractor={c => String(c.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, items.length === 0 && { flexGrow: 1, justifyContent: 'center' }, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>{status === 'PENDING' ? t('acl_empty_pending') : t('adm_org_empty')}</Text>}
        />
      )}

      {rejecting ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setRejecting(null)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setRejecting(null)} accessibilityLabel={t('close')}>
            <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>{t('adm_org_reject_title')}</Text>
              {REJECT_TEMPLATES.map(k => (
                <TouchableOpacity key={k} style={styles.template} onPress={() => setNote(t(k))} accessibilityRole="button">
                  <Text style={styles.templateText}>{t(k)}</Text>
                </TouchableOpacity>
              ))}
              <TextInput value={note} onChangeText={setNote} placeholder={t('adm_org_reject_ph')} placeholderTextColor={colors.textSecondary} style={styles.input} multiline maxLength={500} />
              <TouchableOpacity style={styles.rejectSolid} onPress={() => decide(rejecting, false, note.trim())} accessibilityRole="button">
                <Text style={[styles.btnText, { color: '#fff' }]}>{t('adm_org_reject_send')}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
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
    headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6 },
    chipOn: { backgroundColor: colors.text, borderColor: colors.text },
    chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    chipTextOn: { color: colors.background },
    list: { paddingHorizontal: 16, gap: 12 },
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
    event: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    img: { width: 54, height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    small: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    org: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background, borderRadius: 10, padding: 10 },
    orgName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
    links: { gap: 4 },
    link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
    message: { fontSize: 14, color: colors.text, fontStyle: 'italic', lineHeight: 20 },
    warn: { fontSize: 12, color: colors.primary, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 8 },
    btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11 },
    reject: { borderWidth: 1, borderColor: colors.primary },
    approve: { backgroundColor: colors.accent },
    btnText: { fontWeight: '800', fontSize: 14 },
    empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, paddingHorizontal: 32 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10 },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
    sheetTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    template: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.background },
    templateText: { fontSize: 13, color: colors.text, lineHeight: 18 },
    input: { minHeight: 70, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, color: colors.text, fontSize: 14, padding: 12 },
    rejectSolid: { backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', paddingVertical: 14 },
  });
}
