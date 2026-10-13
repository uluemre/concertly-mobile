import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from '../components/keyboard';
import API from '../services/api';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { goBackOrFallback } from '../navigation/navHelpers';
import { dateLocale } from '../utils/time';

const MAX = 300;
const ERRORS = {
  ANNOUNCE_DISABLED: 'oan_err_disabled',
  ANNOUNCE_LIMIT: 'oan_err_limit',
  MESSAGE_INVALID: 'oan_err_message',
  EVENT_PAST: 'oan_err_past',
  EVENT_CANCELLED: 'oan_err_cancelled',
};
const TEMPLATES = ['oan_tpl_doors', 'oan_tpl_weather', 'oan_tpl_tickets', 'oan_tpl_thanks'];

/** Organizatör: etkinliğe "gidiyorum" diyenlere duyuru (24 saatte bir). */
export default function OrganizerAnnounceScreen({ navigation, route }) {
  const event = route?.params?.event || {};
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [info, setInfo] = useState(null);
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('GOING');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get(`/organizer/events/${event.id}/announcements`);
      setInfo(res.data);
    } catch {
      Alert.alert(t('error'), t('org_load_error'));
    }
  }, [event.id, t]);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const count = audience === 'GOING' ? info?.going : info?.goingInterested;
  const blocked = !info?.canAnnounce || !!info?.nextAllowedAt;

  const send = () => {
    const text = message.trim();
    if (text.length < 3) { Alert.alert(t('error'), t('oan_err_message')); return; }
    if (!count) { Alert.alert(t('error'), t('oan_err_nobody')); return; }
    Alert.alert(t('oan_confirm_title'), t('oan_confirm_msg', { count }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('oan_send'),
        onPress: async () => {
          setSending(true);
          try {
            const res = await API.post(`/organizer/events/${event.id}/announce`, { message: text, audience });
            setMessage('');
            Alert.alert(t('success'), t('oan_sent', { count: res.data.recipients }));
            load();
          } catch (err) {
            const code = err?.response?.data?.message;
            Alert.alert(t('error'), ERRORS[code] ? t(ERRORS[code]) : t('org_action_failed'));
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Organizer')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('oan_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {!info ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={styles.eventName} numberOfLines={2}>{event.name}</Text>

          {!info.canAnnounce ? (
            <View style={styles.notice}><Ionicons name="lock-closed-outline" size={16} color={colors.primary} /><Text style={styles.noticeText}>{t('oan_err_disabled')}</Text></View>
          ) : info.nextAllowedAt ? (
            <View style={styles.notice}><Ionicons name="time-outline" size={16} color={colors.secondary} /><Text style={styles.noticeText}>{t('oan_next', { date: fmt(info.nextAllowedAt) })}</Text></View>
          ) : null}

          <Text style={styles.label}>{t('oan_audience')}</Text>
          <View style={styles.audience}>
            {[['GOING', t('oan_aud_going'), info.going], ['GOING_INTERESTED', t('oan_aud_all'), info.goingInterested]].map(([key, label, n]) => (
              <TouchableOpacity key={key} onPress={() => setAudience(key)} style={[styles.aud, audience === key && styles.audOn]} accessibilityRole="radio" accessibilityState={{ checked: audience === key }}>
                <Text style={[styles.audText, audience === key && styles.audTextOn]}>{label}</Text>
                <Text style={[styles.audCount, audience === key && styles.audTextOn]}>{t('oan_people', { count: n })}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('oan_message')}</Text>
          <View style={styles.templates}>
            {TEMPLATES.map(k => (
              <TouchableOpacity key={k} onPress={() => setMessage(t(k))} style={styles.template} disabled={blocked} accessibilityRole="button">
                <Text style={styles.templateText} numberOfLines={1}>{t(k)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('oan_placeholder')}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            multiline
            maxLength={MAX}
            editable={!blocked}
            accessibilityLabel={t('oan_message')}
          />
          <Text style={styles.counter}>{`${message.length}/${MAX}`}</Text>
          <Text style={styles.hint}>{t('oan_hint')}</Text>

          <TouchableOpacity onPress={send} disabled={blocked || sending || !message.trim()} style={[styles.send, (blocked || sending || !message.trim()) && { opacity: 0.45 }]} accessibilityRole="button">
            {sending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="megaphone" size={18} color="#fff" />
                <Text style={styles.sendText}>{t('oan_send')}</Text>
              </>
            )}
          </TouchableOpacity>

          {info.history?.length ? (
            <>
              <Text style={styles.section}>{t('oan_history')}</Text>
              {info.history.map(h => (
                <View key={h.id} style={styles.historyItem}>
                  <Text style={styles.historyText}>{h.message}</Text>
                  <Text style={styles.small}>{`${fmt(h.createdAt)} · ${t('oan_people', { count: h.recipients })}`}</Text>
                </View>
              ))}
            </>
          ) : null}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    content: { padding: 16, gap: 10 },
    eventName: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
    noticeText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
    label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
    audience: { flexDirection: 'row', gap: 8 },
    aud: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, backgroundColor: colors.card, gap: 2 },
    audOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    audText: { fontSize: 14, fontWeight: '700', color: colors.text },
    audCount: { fontSize: 12, color: colors.textSecondary },
    audTextOn: { color: '#fff' },
    templates: { gap: 6 },
    template: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.card },
    templateText: { fontSize: 13, color: colors.text },
    input: { minHeight: 100, textAlignVertical: 'top', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 },
    counter: { alignSelf: 'flex-end', fontSize: 11, color: colors.textSecondary },
    hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    send: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, marginTop: 4 },
    sendText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    section: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.text, marginTop: 14 },
    historyItem: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
    historyText: { fontSize: 14, color: colors.text, lineHeight: 19 },
    small: { fontSize: 12, color: colors.textSecondary },
  });
}
