// Rozetler: seriler hâlinde (Konserler 1→5→10→25, Paylaşımlar 1→5→20, Başlangıç).
// Her seride mevcut sayı, sıradaki rozete ilerleme ve seviye madalyaları; madalyaya
// dokununca alttan detay paneli açılır. Ad ve açıklamalar çeviriden gelir (sunucu
// metni yalnızca bilinmeyen yeni bir rozet kodu için yedek).
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';
import { dateLocale } from '../../utils/time';
import { hapticSelection } from '../../utils/haptics';

// Seviye renkleri: bronz → gümüş → altın → efsane (marka rengi)
const TIER_COLORS = ['#CD7F32', '#9AA6B2', '#E0A82E', '#E94560'];

const TRACKS = [
  {
    key: 'concerts', titleKey: 'badges_track_concerts', icon: 'musical-notes',
    badges: [
      { code: 'ilk_konser', icon: 'musical-note' },
      { code: 'konser_kurdu', icon: 'musical-notes' },
      { code: 'festival_sezonu', icon: 'ticket' },
      { code: 'efsane_seyirci', icon: 'trophy' },
    ],
  },
  {
    key: 'posts', titleKey: 'badges_track_posts', icon: 'chatbubbles',
    badges: [
      { code: 'ilk_paylasim', icon: 'create' },
      { code: 'sosyal_kelebek', icon: 'chatbubbles' },
      { code: 'icerik_ustasi', icon: 'star' },
    ],
  },
  {
    key: 'start', titleKey: 'badges_track_start', icon: 'sparkles',
    badges: [{ code: 'yeni_uye', icon: 'sparkles' }],
  },
];
const KNOWN = new Set(TRACKS.flatMap(tr => tr.badges.map(b => b.code)));

export default function BadgeGrid({ badges }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useLanguage();
  const [detail, setDetail] = useState(null);

  const byCode = useMemo(() => {
    const m = {};
    for (const b of badges || []) m[b.code] = b;
    return m;
  }, [badges]);

  // Çeviri varsa onu, yoksa sunucu metnini kullan
  const tr = (key, fallback) => {
    const v = t(key);
    return v !== key ? v : (fallback || '');
  };
  const nameOf = (b) => tr(`badge_name_${b.code}`, b.name);
  const descOf = (b) => (b.earned ? tr(`badge_desc_${b.code}`, b.description) : tr(`badge_goal_${b.code}`, b.description));

  const tracks = useMemo(() => {
    const list = TRACKS.map(track => ({
      ...track,
      items: track.badges
        .map((def, tier) => byCode[def.code] && { ...byCode[def.code], ionIcon: def.icon, tier })
        .filter(Boolean),
    })).filter(track => track.items.length > 0);
    // Sunucuya sonradan eklenen, burada tanımı olmayan rozetler "Diğer" serisinde
    const others = (badges || []).filter(b => !KNOWN.has(b.code));
    if (others.length) {
      list.push({
        key: 'other', titleKey: 'badges_track_other', icon: 'ribbon',
        items: others.map((b, i) => ({ ...b, ionIcon: 'ribbon', tier: Math.min(i, TIER_COLORS.length - 1) })),
      });
    }
    return list;
  }, [byCode, badges]);

  const total = (badges || []).length;
  const earnedCount = (badges || []).filter(b => b.earned).length;

  const openDetail = (b) => { hapticSelection(); setDetail(b); };

  return (
    <View>
      {/* ÖZET */}
      <View style={styles.summary}>
        <View style={styles.summaryIcon}>
          <Ionicons name="ribbon" size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle}>{t('badges_summary', { earned: earnedCount, total })}</Text>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: total ? `${(earnedCount / total) * 100}%` : '0%' }]} />
          </View>
        </View>
      </View>

      {/* SERİLER */}
      {tracks.map(track => {
        const next = track.items.find(b => !b.earned);
        const current = next ? next.progress : track.items[track.items.length - 1]?.progress;
        const done = !next;
        return (
          <View key={track.key} style={styles.trackCard}>
            <View style={styles.trackHead}>
              <View style={styles.trackTitleRow}>
                <Ionicons name={track.icon} size={16} color={colors.textSecondary} />
                <Text style={styles.trackTitle}>{t(track.titleKey)}</Text>
              </View>
              {track.items.length > 1 && (
                <Text style={styles.trackCount}>{current ?? 0}</Text>
              )}
            </View>

            {/* Madalyalar ve aralarındaki bağlantı çizgisi */}
            <View style={styles.medalRow}>
              {track.items.map((b, i) => {
                const tierColor = TIER_COLORS[Math.min(b.tier, TIER_COLORS.length - 1)];
                return (
                  <React.Fragment key={b.code}>
                    {i > 0 && (
                      <View style={[styles.connector, { backgroundColor: b.earned ? tierColor : colors.border }]} />
                    )}
                    <TouchableOpacity
                      onPress={() => openDetail(b)}
                      activeOpacity={0.8}
                      style={styles.medalCol}
                      accessibilityRole="button"
                      accessibilityLabel={`${nameOf(b)}, ${b.earned ? t('badges_earned') : t('badges_locked')}`}
                    >
                      <View
                        style={[
                          styles.medal,
                          b.earned
                            ? { backgroundColor: tierColor + '26', borderColor: tierColor }
                            : { backgroundColor: colors.cardAlt, borderColor: colors.border },
                        ]}
                      >
                        <Ionicons
                          name={b.earned ? b.ionIcon : 'lock-closed'}
                          size={b.earned ? 24 : 18}
                          color={b.earned ? tierColor : colors.textSecondary}
                        />
                      </View>
                      <Text style={[styles.medalName, !b.earned && styles.medalNameLocked]} numberOfLines={2}>
                        {nameOf(b)}
                      </Text>
                      {b.required > 1 && (
                        <Text style={styles.medalReq}>{b.required}</Text>
                      )}
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>

            {/* Sıradaki rozete ilerleme */}
            {track.items.length > 1 && (
              done ? (
                <View style={styles.doneRow}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.accent} />
                  <Text style={[styles.nextText, { color: colors.accent }]}>{t('badges_track_done')}</Text>
                </View>
              ) : (
                <View style={styles.nextWrap}>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.trackFill,
                        { width: `${Math.min(100, ((next.progress || 0) / (next.required || 1)) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.nextText}>
                    {t('badges_next', { name: nameOf(next), left: Math.max(0, (next.required || 0) - (next.progress || 0)) })}
                  </Text>
                </View>
              )
            )}
          </View>
        );
      })}

      {/* DETAY PANELİ */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.overlay} onPress={() => setDetail(null)} accessibilityRole="button" accessibilityLabel={t('close')} />
        {detail && (() => {
          const tierColor = TIER_COLORS[Math.min(detail.tier, TIER_COLORS.length - 1)];
          return (
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View
                style={[
                  styles.sheetMedal,
                  detail.earned
                    ? { backgroundColor: tierColor + '26', borderColor: tierColor }
                    : { backgroundColor: colors.cardAlt, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name={detail.earned ? detail.ionIcon : 'lock-closed'}
                  size={40}
                  color={detail.earned ? tierColor : colors.textSecondary}
                />
              </View>
              <Text style={styles.sheetName}>{nameOf(detail)}</Text>
              <Text style={styles.sheetDesc}>{descOf(detail)}</Text>
              {detail.earned ? (
                detail.earnedAt ? (
                  <View style={[styles.sheetPill, { backgroundColor: tierColor + '22' }]}>
                    <Ionicons name="checkmark-circle" size={15} color={tierColor} />
                    <Text style={[styles.sheetPillText, { color: tierColor }]}>
                      {t('badges_earned_on', {
                        date: new Date(detail.earnedAt).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'long', year: 'numeric' }),
                      })}
                    </Text>
                  </View>
                ) : null
              ) : detail.required > 0 ? (
                <View style={styles.sheetProgress}>
                  <View style={[styles.track, { alignSelf: 'stretch' }]}>
                    <View style={[styles.trackFill, { width: `${Math.min(100, (detail.progress / detail.required) * 100)}%` }]} />
                  </View>
                  <Text style={styles.nextText}>{detail.progress}/{detail.required}</Text>
                </View>
              ) : null}
              <TouchableOpacity onPress={() => setDetail(null)} style={styles.sheetClose} accessibilityRole="button">
                <Text style={styles.sheetCloseText}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    summary: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    summaryIcon: {
      width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary + '1F',
    },
    summaryTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 8 },
    track: { height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' },
    trackFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },

    trackCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    trackHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    trackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    trackTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
    trackCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },

    medalRow: { flexDirection: 'row', alignItems: 'flex-start' },
    medalCol: { width: 66, alignItems: 'center' },
    connector: { flex: 1, height: 2, borderRadius: 1, marginTop: 27 },
    medal: {
      width: 56, height: 56, borderRadius: 28, borderWidth: 2,
      alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    },
    medalName: { color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14 },
    medalNameLocked: { color: colors.textSecondary },
    medalReq: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', marginTop: 2 },

    nextWrap: { marginTop: 14, gap: 6 },
    nextText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: 24, paddingTop: 10, paddingBottom: 36, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 20 },
    sheetMedal: {
      width: 88, height: 88, borderRadius: 44, borderWidth: 3,
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    sheetName: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
    sheetDesc: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
    sheetPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
    sheetPillText: { fontSize: 13, fontWeight: '700' },
    sheetProgress: { alignSelf: 'stretch', gap: 6, alignItems: 'center' },
    sheetClose: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 24 },
    sheetCloseText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  });
}
