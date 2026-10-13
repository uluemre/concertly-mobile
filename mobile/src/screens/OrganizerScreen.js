import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { dateLocale, parseEventDate } from '../utils/time';

const TYPES = [
  ['ORGANIZER', 'org_type_organizer', 'megaphone-outline'],
  ['VENUE', 'org_type_venue', 'business-outline'],
  ['ARTIST_MANAGER', 'org_type_manager', 'mic-outline'],
];

const APPLY_ERRORS = {
  ORG_NAME_REQUIRED: 'org_err_name',
  ORG_LINK_REQUIRED: 'org_err_link',
  REQUEST_PENDING: 'org_err_pending',
  ALREADY_ORGANIZER: 'org_err_already',
};

/**
 * Organizatör hesabı: başvuru → inceleme → panel.
 * Panel: kendi etkinlikleri (yaklaşan / geçmiş), her birinin görüntülenme, gidiyor,
 * ilgileniyor, kaydeden ve arkadaş arayan sayıları; ekle, düzenle, iptal et.
 */
export default function OrganizerScreen({ navigation }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState(null);
  const [dash, setDash] = useState(null);
  const [scope, setScope] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (nextScope) => {
    try {
      const me = await API.get('/organizer/me');
      setStatus(me.data);
      if (me.data?.state === 'APPROVED') {
        const d = await API.get('/organizer/dashboard', { params: { scope: nextScope } });
        setDash(d.data);
      }
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Etkinlik formundan dönünce liste tazelensin
  useFocusEffect(useCallback(() => { load(scope); }, [load, scope]));

  const changeScope = (next) => {
    if (next === scope) return;
    setScope(next);
    setDash(prev => (prev ? { ...prev, events: [] } : prev));
  };

  const fmtDate = (iso) => parseEventDate(iso).toLocaleString(dateLocale(lang), {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const toggleCancel = (ev) => {
    const cancelled = ev.delistedReason === 'CANCELLED';
    Alert.alert(
      cancelled ? t('org_uncancel_title') : t('org_cancel_title'),
      cancelled ? t('org_uncancel_msg', { name: ev.name }) : t('org_cancel_msg', { name: ev.name, count: ev.going }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: cancelled ? t('org_uncancel_ok') : t('org_cancel_ok'),
          style: cancelled ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(ev.id);
            try {
              await API.post(`/organizer/events/${ev.id}/${cancelled ? 'uncancel' : 'cancel'}`);
              await load(scope);
            } catch {
              Alert.alert(t('error'), t('org_action_failed'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  // ── Görünümler ────────────────────────────────────────────────────────────
  const header = (title) => (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.backBtn} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header(t('org_title'))}
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  if (error && !status) {
    return (
      <View style={styles.container}>
        {header(t('org_title'))}
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.muted}>{t('org_load_error')}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(scope); }} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const state = status?.state || 'NONE';

  if (state !== 'APPROVED') {
    return (
      <View style={styles.container}>
        {header(t('org_title'))}
        {state === 'PENDING' ? (
          <StatusCard icon="hourglass-outline" tint={colors.secondary} title={t('org_pending_title')} sub={t('org_pending_sub')} request={status.request} styles={styles} t={t} />
        ) : state === 'SUSPENDED' ? (
          <StatusCard icon="pause-circle-outline" tint={colors.primary} title={t('org_suspended_title')} sub={t('org_suspended_sub')} styles={styles} t={t} />
        ) : (
          <ApplyForm
            rejected={state === 'REJECTED' ? status.request : null}
            onDone={() => { setLoading(true); load(scope); }}
            styles={styles}
            colors={colors}
            t={t}
            insets={insets}
          />
        )}
      </View>
    );
  }

  const org = dash?.organizer || status.organizer || {};
  const totals = dash?.totals || {};
  const events = dash?.events || [];

  return (
    <View style={styles.container}>
      {header(t('org_panel_title'))}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(scope); }} tintColor={colors.primary} />}
      >
        <View style={styles.orgCard}>
          <View style={styles.orgLogo}>
            {org.logoUrl
              ? <Image source={{ uri: org.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              : <Ionicons name="business" size={26} color={colors.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.orgNameRow}>
              <Text style={styles.orgName} numberOfLines={1}>{org.name}</Text>
              {org.verified ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} /> : null}
            </View>
            <Text style={styles.muted}>{t(TYPES.find(x => x[0] === org.type)?.[1] || 'org_type_organizer')}</Text>
          </View>
        </View>

        <View style={styles.quick}>
          {[
            ['person-circle-outline', t('orgp_my_profile'), () => navigation.navigate('OrganizerProfile', { organizerId: org.id })],
            ['create-outline', t('orgp_edit'), () => navigation.navigate('OrganizerProfileEdit')],
            ['hand-left-outline', t('ocl_title'), () => navigation.navigate('OrganizerClaim')],
          ].map(([icon, label, onPress]) => (
            <TouchableOpacity key={label} style={styles.quickBtn} onPress={onPress} accessibilityRole="button">
              <Ionicons name={icon} size={18} color={colors.primary} />
              <Text style={styles.quickText} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.totals}>
          <Total value={totals.upcoming} label={t('org_total_upcoming')} styles={styles} />
          <Total value={totals.views} label={t('org_total_views')} styles={styles} />
          <Total value={totals.going} label={t('org_total_going')} styles={styles} />
        </View>

        <View style={styles.tabs}>
          {[['upcoming', t('org_tab_upcoming')], ['past', t('org_tab_past')]].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => changeScope(key)}
              style={[styles.tab, scope === key && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === key }}
            >
              <Text style={[styles.tabText, scope === key && styles.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {events.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.muted}>{scope === 'past' ? t('org_empty_past') : t('org_empty_upcoming')}</Text>
          </View>
        ) : events.map(ev => {
          const cancelled = ev.delistedReason === 'CANCELLED';
          return (
            <View key={ev.id} style={styles.eventCard}>
              <TouchableOpacity style={styles.eventTop} onPress={() => openEvent(navigation, ev.id)} activeOpacity={0.85} accessibilityRole="button">
                <View style={styles.eventImg}>
                  {ev.imageUrl ? <Image source={{ uri: ev.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="musical-notes" size={22} color={colors.textSecondary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventName} numberOfLines={2}>{ev.name}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{fmtDate(ev.eventDate)}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{[ev.venueName, ev.venueCity].filter(Boolean).join(' · ')}</Text>
                </View>
                {cancelled ? (
                  <View style={styles.cancelBadge}><Text style={styles.cancelBadgeText}>{t('event_cancelled_badge')}</Text></View>
                ) : null}
              </TouchableOpacity>

              <View style={styles.stats}>
                <Stat icon="eye-outline" value={ev.views} label={t('org_stat_views')} styles={styles} colors={colors} />
                <Stat icon="checkmark-circle-outline" value={scope === 'past' ? ev.went : ev.going} label={scope === 'past' ? t('org_stat_went') : t('org_stat_going')} styles={styles} colors={colors} />
                <Stat icon="star-outline" value={ev.interested} label={t('org_stat_interested')} styles={styles} colors={colors} />
                <Stat icon="bookmark-outline" value={ev.saves} label={t('org_stat_saves')} styles={styles} colors={colors} />
                <Stat icon="people-outline" value={ev.buddies} label={t('org_stat_buddies')} styles={styles} colors={colors} />
              </View>

              {scope === 'upcoming' ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('OrganizerEventForm', { event: ev })}
                    style={styles.actionBtn}
                    disabled={cancelled}
                    accessibilityRole="button"
                  >
                    <Ionicons name="create-outline" size={16} color={cancelled ? colors.textSecondary : colors.text} />
                    <Text style={[styles.actionText, cancelled && { color: colors.textSecondary }]}>{t('org_edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('OrganizerAnnounce', { event: { id: ev.id, name: ev.name } })}
                    style={styles.actionBtn}
                    disabled={cancelled}
                    accessibilityRole="button"
                  >
                    <Ionicons name="megaphone-outline" size={16} color={cancelled ? colors.textSecondary : colors.text} />
                    <Text style={[styles.actionText, cancelled && { color: colors.textSecondary }]}>{t('oan_short')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleCancel(ev)} style={styles.actionBtn} disabled={busyId === ev.id} accessibilityRole="button">
                    {busyId === ev.id
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name={cancelled ? 'refresh-outline' : 'close-circle-outline'} size={16} color={colors.primary} />}
                    <Text style={[styles.actionText, { color: colors.primary }]}>{cancelled ? t('org_uncancel_ok') : t('org_cancel_ok')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => navigation.navigate('OrganizerEventForm')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('org_add_event')}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>{t('org_add_event')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Total({ value, label, styles }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalValue}>{value ?? 0}</Text>
      <Text style={styles.totalLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Stat({ icon, value, label, styles, colors }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value ?? 0}`}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function StatusCard({ icon, tint, title, sub, request, styles, t }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.statusCard}>
        <View style={[styles.statusIcon, { backgroundColor: `${tint}1F` }]}>
          <Ionicons name={icon} size={30} color={tint} />
        </View>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusSub}>{sub}</Text>
        {request ? (
          <View style={styles.requestBox}>
            <Text style={styles.requestName}>{request.organizationName}</Text>
            {[request.website, request.instagram].filter(Boolean).map(x => (
              <Text key={x} style={styles.muted} numberOfLines={1}>{x}</Text>
            ))}
          </View>
        ) : null}
        {request?.status === 'PENDING' ? <Text style={styles.muted}>{t('org_pending_eta')}</Text> : null}
      </View>
    </ScrollView>
  );
}

/** Başvuru formu; reddedilen başvurunun notu üstte gösterilir. */
function ApplyForm({ rejected, onDone, styles, colors, t, insets }) {
  const [form, setForm] = useState({
    organizationName: rejected?.organizationName || '',
    type: rejected?.type || 'ORGANIZER',
    website: rejected?.website || '',
    instagram: rejected?.instagram || '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.organizationName.trim()) return Alert.alert(t('error'), t('org_err_name'));
    if (!form.website.trim() && !form.instagram.trim()) return Alert.alert(t('error'), t('org_err_link'));
    setSending(true);
    try {
      await API.post('/organizer/requests', {
        organizationName: form.organizationName.trim(),
        type: form.type,
        website: form.website.trim() || null,
        instagram: form.instagram.trim() || null,
        message: form.message.trim() || null,
      });
      Alert.alert(t('org_applied_title'), t('org_applied_msg'));
      onDone();
    } catch (err) {
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), APPLY_ERRORS[code] ? t(APPLY_ERRORS[code]) : t('org_action_failed'));
    } finally {
      setSending(false);
    }
  };

  const input = (key, label, opts = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        placeholder={opts.placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, opts.multiline && styles.inputMulti]}
        multiline={!!opts.multiline}
        autoCapitalize={opts.autoCapitalize || 'sentences'}
        keyboardType={opts.keyboardType || 'default'}
        autoCorrect={!opts.noCorrect}
        maxLength={opts.maxLength}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Ionicons name="business" size={32} color={colors.primary} />
        <Text style={styles.heroTitle}>{t('org_intro_title')}</Text>
        <Text style={styles.heroSub}>{t('org_intro_sub')}</Text>
        {['org_benefit_publish', 'org_benefit_stats', 'org_benefit_badge'].map(k => (
          <View key={k} style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={styles.benefitText}>{t(k)}</Text>
          </View>
        ))}
      </View>

      {rejected ? (
        <View style={styles.rejected}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rejectedTitle}>{t('org_rejected_title')}</Text>
            {rejected.reviewNote ? <Text style={styles.muted}>{rejected.reviewNote}</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.formCard}>
        {input('organizationName', t('org_field_name'), { placeholder: t('org_field_name_ph'), maxLength: 120 })}
        <View style={styles.field}>
          <Text style={styles.label}>{t('org_field_type')}</Text>
          <View style={styles.typeRow}>
            {TYPES.map(([key, label, icon]) => {
              const on = form.type === key;
              return (
                <TouchableOpacity key={key} onPress={() => set('type', key)} style={[styles.typeChip, on && styles.typeChipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                  <Ionicons name={icon} size={16} color={on ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.typeText, on && styles.typeTextOn]} numberOfLines={1}>{t(label)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {input('website', t('org_field_website'), { placeholder: 'https://', autoCapitalize: 'none', keyboardType: 'url', noCorrect: true })}
        {input('instagram', t('org_field_instagram'), { placeholder: '@hesap', autoCapitalize: 'none', noCorrect: true })}
        <Text style={styles.fieldHint}>{t('org_field_link_hint')}</Text>
        {input('message', t('org_field_message'), { placeholder: t('org_field_message_ph'), multiline: true, maxLength: 1000 })}
      </View>

      <TouchableOpacity onPress={submit} disabled={sending} style={[styles.submit, sending && { opacity: 0.6 }]} accessibilityRole="button">
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{rejected ? t('org_reapply') : t('org_apply')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    content: { padding: 16, gap: 14 },
    muted: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    // Başvuru
    hero: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 8 },
    heroTitle: { fontSize: 22, fontFamily: fonts.heading, color: colors.text },
    heroSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 4 },
    benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    benefitText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
    rejected: { flexDirection: 'row', gap: 10, backgroundColor: `${colors.primary}14`, borderRadius: 14, padding: 12 },
    rejectedTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
    formCard: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 },
    field: { gap: 6, paddingVertical: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    fieldHint: { fontSize: 11, color: colors.textSecondary, marginTop: -2, lineHeight: 15 },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background,
      color: colors.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10,
    },
    inputMulti: { minHeight: 80, textAlignVertical: 'top' },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: {
      flex: 1, alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.background, paddingVertical: 10, paddingHorizontal: 4,
    },
    typeChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    typeTextOn: { color: '#fff' },
    submit: { backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', paddingVertical: 15 },

    // Durum kartı
    statusCard: { alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 24 },
    statusIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    statusTitle: { fontSize: 20, fontFamily: fonts.heading, color: colors.text, textAlign: 'center' },
    statusSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    requestBox: { alignSelf: 'stretch', backgroundColor: colors.background, borderRadius: 12, padding: 12, gap: 2, marginTop: 4 },
    requestName: { fontSize: 15, fontWeight: '700', color: colors.text },

    // Panel
    orgCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14 },
    orgLogo: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center' },
    orgNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    orgName: { flexShrink: 1, fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    quick: { flexDirection: 'row', gap: 8 },
    quickBtn: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 4 },
    quickText: { fontSize: 11, fontWeight: '700', color: colors.text },
    totals: { flexDirection: 'row', gap: 10 },
    total: { flex: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center' },
    totalValue: { fontSize: 22, fontFamily: fonts.headingBold, color: colors.text },
    totalLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    tabs: { flexDirection: 'row', gap: 8 },
    tab: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 7 },
    tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
    tabTextOn: { color: '#fff' },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
    eventCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
    eventTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    eventImg: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    eventName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    cancelBadge: { backgroundColor: `${colors.primary}1F`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
    cancelBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
    stats: { flexDirection: 'row', justifyContent: 'space-between' },
    stat: { alignItems: 'center', flex: 1, gap: 1 },
    statValue: { fontSize: 15, fontWeight: '800', color: colors.text },
    statLabel: { fontSize: 10, color: colors.textSecondary },
    actions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
    actionText: { fontSize: 13, fontWeight: '700', color: colors.text },
    fab: {
      position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: 28, paddingHorizontal: 18, paddingVertical: 14,
      boxShadow: `0 6px 16px ${colors.primary}66`,
    },
    fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
}
