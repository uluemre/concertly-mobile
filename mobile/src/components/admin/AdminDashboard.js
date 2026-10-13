import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';
import API from '../../services/api';
import { dateLocale, parseEventDate } from '../../utils/time';

const PERIODS = [7, 30, 90];
const KPIS = [
  ['activeUsers', 'dash_kpi_active', 'pulse'],
  ['newUsers', 'dash_kpi_new_users', 'person-add'],
  ['posts', 'dash_kpi_posts', 'document-text'],
  ['messages', 'dash_kpi_messages', 'chatbubbles'],
  ['going', 'dash_kpi_going', 'ticket'],
  ['matches', 'dash_kpi_matches', 'heart'],
];
const METRICS = [['active', 'dash_kpi_active'], ['signups', 'dash_kpi_new_users'], ['posts', 'dash_kpi_posts']];
const PENDING = [
  ['reports', 'dash_pending_reports', 'flag', 'AdminReports', undefined],
  ['events', 'dash_pending_events', 'hourglass', 'AdminEvents', { filter: 'pending' }],
  ['organizers', 'dash_pending_organizers', 'business', 'AdminOrganizerRequests', undefined],
  ['communities', 'dash_pending_communities', 'people-circle', 'AdminCommunities', undefined],
  ['claims', 'dash_pending_claims', 'hand-left', 'AdminClaims', undefined],
];

/** Önceki döneme göre değişim: { pct, dir } — önceki 0 ise "yeni" sayılır */
function delta(value, previous) {
  const v = Number(value) || 0;
  const p = Number(previous) || 0;
  if (v === p) return { dir: 0, pct: 0 };
  if (p === 0) return { dir: 1, pct: null };
  return { dir: v > p ? 1 : -1, pct: Math.round(((v - p) / p) * 100) };
}

/** 90 günlük seri haftalara toplanır: çubuklar okunur kalsın */
function bucket(series, metric, days) {
  const rows = (series || []).map(r => ({ day: r.day, value: Number(r[metric]) || 0 }));
  if (days <= 30) return rows;
  const weeks = [];
  for (let i = 0; i < rows.length; i += 7) {
    const chunk = rows.slice(i, i + 7);
    // Aktif kullanıcı haftalık toplanmaz (aynı kişi her gün sayılırdı): haftanın en yüksek günü
    const value = metric === 'active' ? Math.max(...chunk.map(c => c.value)) : chunk.reduce((s, c) => s + c.value, 0);
    weeks.push({ day: chunk[0].day, to: chunk[chunk.length - 1].day, value });
  }
  return weeks;
}

/**
 * Admin ana sayfası (Shopify / Stripe paneli gibi): bekleyen işler, dönem karşılaştırmalı
 * ana sayılar, günlük grafik, şehir dağılımı, en popüler konser ve sanatçılar.
 */
export default function AdminDashboard({ navigation, refreshKey }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState('active');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [picked, setPicked] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await API.get('/admin/dashboard', { params: { days } });
      setData(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPicked(null); }, [days, metric]);

  const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short' });
  const num = (n) => Number(n || 0).toLocaleString(dateLocale(lang));

  if (loading && !data) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />;
  if (error && !data) {
    return (
      <TouchableOpacity style={styles.errorBox} onPress={() => { setLoading(true); load(); }} accessibilityRole="button">
        <Ionicons name="cloud-offline-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.muted}>{t('dash_load_error')}</Text>
      </TouchableOpacity>
    );
  }

  const pending = data.pending || {};
  const pendingTotal = PENDING.reduce((s, [k]) => s + (Number(pending[k]) || 0), 0);
  const bars = bucket(data.series, metric, data.days);
  const max = Math.max(1, ...bars.map(b => b.value));
  const total = metric === 'active' ? null : bars.reduce((s, b) => s + b.value, 0);
  const cities = data.cities || [];
  const cityMax = Math.max(1, ...cities.map(c => Number(c.users) || 0));

  return (
    <View style={styles.wrap}>
      {/* Dönem */}
      <View style={styles.periods}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p} onPress={() => setDays(p)} style={[styles.period, days === p && styles.periodOn]} accessibilityRole="tab" accessibilityState={{ selected: days === p }}>
            <Text style={[styles.periodText, days === p && styles.periodTextOn]}>{t('dash_days', { count: p })}</Text>
          </TouchableOpacity>
        ))}
        {loading ? <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 6 }} /> : null}
      </View>

      {/* Bekleyen işler */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{t('dash_pending_title')}</Text>
          {pendingTotal === 0 ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} /> : null}
        </View>
        {pendingTotal === 0 ? <Text style={styles.muted}>{t('dash_pending_none')}</Text> : PENDING.map(([key, label, icon, screen, params]) => {
          const n = Number(pending[key]) || 0;
          if (n === 0) return null;
          return (
            <TouchableOpacity key={key} style={styles.pendingRow} onPress={() => navigation.navigate(screen, params)} accessibilityRole="button" accessibilityLabel={`${t(label)}: ${n}`}>
              <Ionicons name={icon} size={18} color={colors.secondary} />
              <Text style={styles.pendingText}>{t(label)}</Text>
              <View style={styles.pendingCount}><Text style={styles.pendingCountText}>{n}</Text></View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Ana sayılar */}
      <View style={styles.kpis}>
        {KPIS.map(([key, label, icon]) => {
          const k = data.kpis?.[key] || {};
          const d = delta(k.value, k.previous);
          const tone = d.dir > 0 ? colors.accent : d.dir < 0 ? colors.primary : colors.textSecondary;
          return (
            <View key={key} style={styles.kpi} accessible accessibilityLabel={`${t(label)}: ${k.value ?? 0}`}>
              <View style={styles.kpiHead}>
                <Ionicons name={icon} size={14} color={colors.textSecondary} />
                <Text style={styles.kpiLabel} numberOfLines={1}>{t(label)}</Text>
              </View>
              <Text style={styles.kpiValue}>{num(k.value)}</Text>
              <View style={styles.deltaRow}>
                <Ionicons name={d.dir > 0 ? 'arrow-up' : d.dir < 0 ? 'arrow-down' : 'remove'} size={12} color={tone} />
                <Text style={[styles.deltaText, { color: tone }]} numberOfLines={1}>
                  {d.dir === 0 ? t('dash_delta_same') : d.pct === null ? t('dash_delta_new') : t('dash_delta_pct', { pct: Math.abs(d.pct) })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.footnote}>
        {t('dash_totals', { users: num(data.kpis?.totalUsers), events: num(data.kpis?.upcomingEvents), days: data.days })}
      </Text>

      {/* Günlük grafik */}
      <View style={styles.card}>
        <View style={styles.metrics}>
          {METRICS.map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setMetric(key)} style={[styles.metric, metric === key && styles.metricOn]} accessibilityRole="tab" accessibilityState={{ selected: metric === key }}>
              <Text style={[styles.metricText, metric === key && styles.metricTextOn]}>{t(label)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.chartReadout}>
          {picked
            ? `${picked.to ? `${fmtDay(picked.day)} – ${fmtDay(picked.to)}` : fmtDay(picked.day)}: ${num(picked.value)}`
            : total !== null ? t('dash_chart_total', { total: num(total) }) : t('dash_chart_hint')}
        </Text>
        <View style={styles.chart}>
          <Text style={styles.axisMax}>{num(max)}</Text>
          <View style={styles.gridLine} />
          <View style={styles.bars}>
            {bars.map(b => {
              const on = picked && picked.day === b.day;
              return (
                <Pressable
                  key={b.day}
                  style={styles.barSlot}
                  onPress={() => setPicked(on ? null : b)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  accessibilityLabel={`${fmtDay(b.day)}: ${b.value}`}
                >
                  <View style={[
                    styles.bar,
                    { height: `${Math.max(b.value > 0 ? 3 : 0, (b.value / max) * 100)}%`, backgroundColor: colors.primary },
                    picked && !on && { opacity: 0.35 },
                  ]} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.axisDates}>
          <Text style={styles.axisText}>{bars.length ? fmtDay(bars[0].day) : ''}</Text>
          <Text style={styles.axisText}>{data.days > 30 ? t('dash_weekly') : ''}</Text>
          <Text style={styles.axisText}>{bars.length ? fmtDay(bars[bars.length - 1].to || bars[bars.length - 1].day) : ''}</Text>
        </View>
      </View>

      {/* Şehirler */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('dash_cities')}</Text>
        {cities.map(c => (
          <View key={c.city} style={styles.cityRow} accessible accessibilityLabel={`${c.city}: ${c.users}`}>
            <Text style={styles.cityName} numberOfLines={1}>{c.city}</Text>
            <View style={styles.cityTrack}>
              <View style={[styles.cityBar, { width: `${(Number(c.users) / cityMax) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={styles.cityValue}>{num(c.users)}</Text>
          </View>
        ))}
      </View>

      {/* Popüler konserler */}
      {data.topEvents?.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dash_top_events')}</Text>
          {data.topEvents.map((e, i) => (
            <TouchableOpacity key={e.id} style={styles.topRow} onPress={() => navigation.navigate('EventDetail', { eventId: e.id })} accessibilityRole="button">
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.topName} numberOfLines={1}>{e.name}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {[e.city, parseEventDate(e.eventDate).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={styles.topValue}>{t('dash_going_n', { count: e.going })}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Popüler sanatçılar */}
      {data.topArtists?.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dash_top_artists')}</Text>
          {data.topArtists.map((a, i) => (
            <TouchableOpacity key={a.id} style={styles.topRow} onPress={() => navigation.navigate('AdminCatalogEdit', { kind: 'artists', id: a.id, name: a.name })} accessibilityRole="button">
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={[styles.topName, { flex: 1 }]} numberOfLines={1}>{a.name}</Text>
              <Text style={styles.topValue}>{t('adm_org_followers_n', { count: a.followers })}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: 16, gap: 12 },
    muted: { fontSize: 12, color: colors.textSecondary },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 14, borderRadius: 14, backgroundColor: colors.card },
    periods: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    period: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 7 },
    periodOn: { backgroundColor: colors.text, borderColor: colors.text },
    periodText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    periodTextOn: { color: colors.background },
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.text },
    pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    pendingText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
    pendingCount: { minWidth: 26, alignItems: 'center', backgroundColor: colors.secondary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    pendingCountText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    kpi: { width: '48.5%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 2 },
    kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    kpiLabel: { flex: 1, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    kpiValue: { fontSize: 24, fontFamily: fonts.headingBold, color: colors.text },
    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    deltaText: { fontSize: 11, fontWeight: '700' },
    footnote: { fontSize: 11, color: colors.textSecondary, marginTop: -4 },
    metrics: { flexDirection: 'row', gap: 6 },
    metric: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.background },
    metricOn: { backgroundColor: `${colors.primary}22` },
    metricText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    metricTextOn: { color: colors.text },
    chartReadout: { fontSize: 13, fontWeight: '700', color: colors.text },
    chart: { height: 120, justifyContent: 'flex-end' },
    axisMax: { position: 'absolute', top: -2, left: 0, fontSize: 10, color: colors.textSecondary },
    gridLine: { position: 'absolute', top: 12, left: 0, right: 0, height: 1, backgroundColor: colors.border, opacity: 0.6 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', height: 104, borderBottomWidth: 1, borderBottomColor: colors.border },
    barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
    bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
    axisDates: { flexDirection: 'row', justifyContent: 'space-between' },
    axisText: { fontSize: 10, color: colors.textSecondary },
    cityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cityName: { width: 78, fontSize: 12, color: colors.text, fontWeight: '600' },
    cityTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' },
    cityBar: { height: '100%', borderRadius: 4 },
    cityValue: { width: 34, textAlign: 'right', fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    rank: { width: 18, fontSize: 13, fontWeight: '800', color: colors.textSecondary },
    topName: { fontSize: 14, fontWeight: '700', color: colors.text },
    topValue: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  });
}
