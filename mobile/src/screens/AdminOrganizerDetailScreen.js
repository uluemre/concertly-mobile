import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { dateLocale, parseEventDate } from '../utils/time';
import { accountAge, openInstagram, openWebsite, orgTypeKey } from '../utils/adminOrganizer';

/** Onaylı organizatör: askıya al, duyuru yetkisi, doğrulama rozeti; etkinlikleri ve istatistikleri. */
export default function AdminOrganizerDetailScreen({ navigation, route }) {
  const id = route?.params?.id;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [scope, setScope] = useState('upcoming');

  const load = useCallback(async () => {
    try {
      const res = await API.get(`/admin/organizers/${id}`);
      setOrg(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patch = async (key, value) => {
    setBusyKey(key);
    const prev = org;
    setOrg(o => ({ ...o, [key]: value })); // iyimser
    try {
      const res = await API.patch(`/admin/organizers/${id}`, { [key]: value });
      setOrg(res.data);
    } catch {
      setOrg(prev);
      Alert.alert(t('error'), t('admin_organizer_action_error'));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleActive = (next) => {
    if (next) { patch('active', true); return; }
    Alert.alert(t('adm_org_suspend_title'), t('adm_org_suspend_msg', { name: org.name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('adm_org_suspend_ok'), style: 'destructive', onPress: () => patch('active', false) },
    ]);
  };

  const fmtEvent = (iso) => parseEventDate(iso).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (error || !org) {
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

  const owner = org.owner || {};
  const totals = org.totals || {};
  const events = (scope === 'upcoming' ? org.upcoming : org.past) || [];

  const switchRow = (key, icon, label, sub, value, onChange) => (
    <View style={styles.switchRow} key={key}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
      {busyKey === key ? <ActivityIndicator color={colors.primary} style={{ width: 51 }} /> : (
        <Switch value={!!value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" accessibilityLabel={label} />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'AdminOrganizerRequests')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{org.name}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.logo}>
              {org.logoUrl ? <Image source={{ uri: org.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="business" size={26} color={colors.primary} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>{org.name}</Text>
                {org.verified ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} /> : null}
              </View>
              <Text style={styles.muted}>{t(orgTypeKey(org.type))}</Text>
              {!org.active ? (
                <View style={styles.suspended}><Text style={styles.suspendedText}>{t('adm_org_suspended')}</Text></View>
              ) : null}
            </View>
          </View>
          {org.website ? (
            <TouchableOpacity style={styles.link} onPress={() => openWebsite(org.website)} accessibilityRole="link">
              <Ionicons name="globe-outline" size={15} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>{org.website}</Text>
            </TouchableOpacity>
          ) : null}
          {org.instagram ? (
            <TouchableOpacity style={styles.link} onPress={() => openInstagram(org.instagram)} accessibilityRole="link">
              <Ionicons name="logo-instagram" size={15} color={colors.primary} />
              <Text style={styles.linkText} numberOfLines={1}>{org.instagram}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('UserProfile', { userId: owner.userId })} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.small}>{t('adm_org_owner')}</Text>
          <View style={styles.row}>
            <Text style={[styles.switchLabel, { flex: 1 }]} numberOfLines={1}>
              {`${owner.fullName || ''} @${owner.username}`.trim()}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
          <Text style={styles.small}>
            {[
              t('adm_org_joined', { age: accountAge(owner.accountCreatedAt).label(t) }),
              t('adm_org_followers_n', { count: owner.followers }),
              owner.reports > 0 ? t('adm_org_reports_n', { count: owner.reports }) : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        </TouchableOpacity>

        <View style={styles.card}>
          {switchRow('active', 'power-outline', t('adm_org_sw_active'), t('adm_org_sw_active_sub'), org.active, toggleActive)}
          <View style={styles.sep} />
          {switchRow('canAnnounce', 'megaphone-outline', t('adm_org_sw_announce'), t('adm_org_sw_announce_sub'), org.canAnnounce, v => patch('canAnnounce', v))}
          <View style={styles.sep} />
          {switchRow('verified', 'checkmark-circle-outline', t('adm_org_sw_verified'), t('adm_org_sw_verified_sub'), org.verified, v => patch('verified', v))}
        </View>

        <View style={styles.totals}>
          {[[totals.upcoming, t('org_total_upcoming')], [totals.views, t('org_total_views')], [totals.going, t('org_total_going')]].map(([v, l]) => (
            <View key={l} style={styles.total}>
              <Text style={styles.totalValue}>{v ?? 0}</Text>
              <Text style={styles.small}>{l}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabs}>
          {[['upcoming', t('org_tab_upcoming')], ['past', t('org_tab_past')]].map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setScope(key)} style={[styles.tab, scope === key && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: scope === key }}>
              <Text style={[styles.tabText, scope === key && styles.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {events.length === 0 ? (
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 16 }]}>{scope === 'past' ? t('org_empty_past') : t('adm_org_no_upcoming')}</Text>
        ) : events.map(ev => (
          <TouchableOpacity key={ev.id} style={styles.event} onPress={() => openEvent(navigation, ev.id)} activeOpacity={0.85} accessibilityRole="button">
            <View style={styles.eventImg}>
              {ev.imageUrl ? <Image source={{ uri: ev.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="musical-notes" size={18} color={colors.textSecondary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventName} numberOfLines={1}>{ev.name}</Text>
              <Text style={styles.small} numberOfLines={1}>{`${fmtEvent(ev.eventDate)} · ${[ev.venueName, ev.venueCity].filter(Boolean).join(', ')}`}</Text>
              <Text style={styles.small} numberOfLines={1}>
                {`👁 ${ev.views}  ✓ ${scope === 'past' ? ev.went : ev.going}  ★ ${ev.interested}  🔖 ${ev.saves}`}
                {ev.delistedReason === 'CANCELLED' ? `  · ${t('event_cancelled_badge')}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
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
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
    logo: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center' },
    title: { flexShrink: 1, fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    suspended: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: `${colors.primary}1F`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    suspendedText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
    link: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background, borderRadius: 10, padding: 9 },
    linkText: { flex: 1, color: colors.primary, fontWeight: '600', fontSize: 13 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    sep: { height: 1, backgroundColor: colors.border },
    totals: { flexDirection: 'row', gap: 8 },
    total: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 10 },
    totalValue: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
    tabs: { flexDirection: 'row', gap: 8 },
    tab: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 7 },
    tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
    tabTextOn: { color: '#fff' },
    event: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 },
    eventImg: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    eventName: { fontSize: 14, fontWeight: '700', color: colors.text },
  });
}
