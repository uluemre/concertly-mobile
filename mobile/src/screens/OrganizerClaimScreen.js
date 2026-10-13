import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import API from '../services/api';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { dateLocale, parseEventDate } from '../utils/time';

const ERRORS = {
  EVENT_HAS_ORGANIZER: 'ocl_err_has_org',
  CLAIM_PENDING: 'ocl_err_pending',
  EVENT_PAST: 'ocl_err_past',
};
const STATUS_TONE = { PENDING: 'secondary', APPROVED: 'accent', REJECTED: 'primary' };

/**
 * "Bu etkinlik benim": bilet sitelerinden gelen etkinliği organizatör paneline almak için talep.
 * Admin onaylayınca etkinlik panelde görünür (düzenleme, iptal, duyuru, istatistik).
 */
export default function OrganizerClaimScreen({ navigation, route }) {
  const presetId = route?.params?.eventId;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);
  const [target, setTarget] = useState(null); // { id, name, ... } talep penceresi
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fmt = (iso) => parseEventDate(iso).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric' });

  const loadMine = useCallback(() => {
    API.get('/organizer/claims').then(res => setMine(res.data || [])).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { loadMine(); }, [loadMine]));

  // Panelden "kopya etkinlik" uyarısıyla gelindiyse o etkinlik doğrudan açılır
  useEffect(() => {
    if (!presetId) return;
    API.get(`/events/${presetId}`).then(res => setTarget({ id: res.data.id, name: res.data.name, eventDate: res.data.eventDate, venueName: res.data.venueName })).catch(() => {});
  }, [presetId]);

  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return undefined; }
    let alive = true;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const res = await API.get('/organizer/claimable', { params: { q: q.trim() } });
        if (alive) setRows(res.data || []);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setBusy(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [q]);

  const submit = async () => {
    setSending(true);
    try {
      await API.post('/organizer/claims', { eventId: target.id, message: message.trim() || null });
      setTarget(null);
      setMessage('');
      setRows(prev => prev.map(r => (r.id === target.id ? { ...r, claimPending: true } : r)));
      loadMine();
      Alert.alert(t('success'), t('ocl_sent'));
    } catch (err) {
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), ERRORS[code] ? t(ERRORS[code]) : t('org_action_failed'));
    } finally {
      setSending(false);
    }
  };

  const header = (
    <View>
      <Text style={styles.intro}>{t('ocl_intro')}</Text>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('ocl_search')} placeholderTextColor={colors.textSecondary} style={styles.searchInput} autoCorrect={false} />
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      {q.trim().length >= 2 && !busy && rows.length === 0 ? <Text style={styles.empty}>{t('ocl_none')}</Text> : null}
    </View>
  );

  const footer = mine.length ? (
    <View style={{ marginTop: 18, gap: 8 }}>
      <Text style={styles.section}>{t('ocl_mine')}</Text>
      {mine.map(c => (
        <TouchableOpacity key={c.id} style={styles.claim} onPress={() => openEvent(navigation, c.eventId)} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.eventName} numberOfLines={1}>{c.eventName}</Text>
            <Text style={styles.small} numberOfLines={1}>{[fmt(c.eventDate), c.venueName].filter(Boolean).join(' · ')}</Text>
            {c.reviewNote ? <Text style={styles.small}>{c.reviewNote}</Text> : null}
          </View>
          <View style={[styles.status, { backgroundColor: `${colors[STATUS_TONE[c.status]] || colors.textSecondary}22` }]}>
            <Text style={[styles.statusText, { color: colors[STATUS_TONE[c.status]] || colors.textSecondary }]}>{t(`ocl_status_${c.status.toLowerCase()}`)}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Organizer')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('ocl_title')}</Text>
        <View style={styles.backBtn} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => String(r.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.img}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="musical-notes" size={18} color={colors.textSecondary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.small} numberOfLines={1}>{[fmt(item.eventDate), item.venueName, item.venueCity].filter(Boolean).join(' · ')}</Text>
            </View>
            {item.claimPending ? (
              <Text style={styles.pending}>{t('ocl_status_pending')}</Text>
            ) : (
              <TouchableOpacity style={styles.claimBtn} onPress={() => setTarget(item)} accessibilityRole="button">
                <Text style={styles.claimText}>{t('ocl_claim')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {target ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setTarget(null)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setTarget(null)} accessibilityLabel={t('close')}>
            <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>{t('ocl_sheet_title')}</Text>
              <Text style={styles.eventName}>{target.name}</Text>
              <Text style={styles.small}>{t('ocl_sheet_hint')}</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={t('ocl_message_ph')}
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity style={[styles.send, sending && { opacity: 0.6 }]} onPress={submit} disabled={sending} accessibilityRole="button">
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>{t('ocl_send')}</Text>}
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
    headerBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    content: { padding: 16, gap: 8 },
    intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 10 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 6 },
    searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
    empty: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 },
    img: { width: 50, height: 50, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    eventName: { fontSize: 14, fontWeight: '700', color: colors.text },
    small: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    claimBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    claimText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    pending: { fontSize: 12, fontWeight: '700', color: colors.secondary },
    section: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.text },
    claim: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
    status: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    statusText: { fontSize: 11, fontWeight: '800' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10 },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
    sheetTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    input: { minHeight: 90, textAlignVertical: 'top', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 14 },
    send: { backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', paddingVertical: 14 },
    sendText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
}
