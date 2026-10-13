import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '../../theme';
import EventImage from '../EventImage';
import { getGenreGradient } from '../../utils/gradients';
import { parseEventDate } from '../../utils/time';
import { displayName, eventTitle, onPhoto, reasonsFor, scoreOf, splitGenres } from './buddyUtils';

// Deste kartının tam profili: neden uyumlusunuz, birlikte gidilebilecek konserler,
// hakkında, türler, sanatçılar ve gittiği konserler. Altta karar düğmeleri.
export default function BuddyProfileModal({
  card, status, t, tu, locale,
  onClose, onDecide, onChat, onMenu, onScore, onEvent, onFullProfile,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  if (!card) return null;

  const score = scoreOf(card);
  const genres = splitGenres(card.favoriteGenres);
  const sharedGenres = new Set((card.sharedGenres || []).map(g => g.toLowerCase()));
  const sharedArtists = new Set(card.sharedArtists || []);
  const shared = card.sharedEvents || [];
  const concerts = card.recentConcerts || [];
  const artists = card.topArtists || [];
  const bio = card.bio ? card.bio.trim() : '';
  const focus = shared[0];

  const dateParts = (iso) => {
    const d = parseEventDate(iso);
    return { day: d.getDate(), month: d.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toLocaleUpperCase(locale) };
  };

  const section = (icon, title, body) => (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={14} color={colors.primary} />
        <Text style={styles.sectionLabel}>{title}</Text>
      </View>
      {body}
    </View>
  );
  const chip = (key, label, strong, icon) => (
    <View key={key} style={[styles.chip, strong && styles.chipStrong]}>
      {icon ? <Ionicons name={icon} size={12} color={strong ? colors.primary : colors.textSecondary} /> : null}
      <Text style={[styles.chipText, strong && { color: colors.text }]} numberOfLines={2}>{label}</Text>
    </View>
  );
  const eventRow = (ev) => {
    const parts = dateParts(ev.eventDate);
    return (
      <TouchableOpacity key={ev.id} style={styles.eventRow} onPress={() => onEvent(ev.id)} activeOpacity={0.8} accessibilityRole="button">
        <EventImage item={{ ...ev, name: eventTitle(ev) }} style={styles.eventThumb} initialsSize={14}>
          <View style={styles.eventDate}>
            <Text style={styles.eventDay}>{parts.day}</Text>
            <Text style={styles.eventMonth}>{parts.month}</Text>
          </View>
        </EventImage>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventName} numberOfLines={1}>{eventTitle(ev)}</Text>
          <Text style={styles.eventMeta} numberOfLines={1}>{[ev.venueName, ev.venueCity].filter(Boolean).join(' · ')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" statusBarTranslucent>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { height: Math.round(height * 0.58) }]}>
            {card.profileImageUrl ? (
              <Image source={{ uri: card.profileImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
            ) : (
              <LinearGradient colors={getGenreGradient(genres[0])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.fallback]}>
                <Text style={styles.initial}>{card.username?.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )}
            <LinearGradient
              colors={['transparent', onPhoto.fade, colors.background]}
              locations={[0.4, 0.65, 1]}
              style={StyleSheet.absoluteFill}
            />
            <TouchableOpacity
              style={styles.score}
              onPress={onScore}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${t('buddy_compat_label')} %${score}`}
              accessibilityHint={t('buddy_compat_explain_title')}
            >
              <Text style={styles.scoreValue}>%{score}</Text>
              <Text style={styles.scoreLabel}>{t('buddy_compat_label')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.name} accessibilityRole="header">{displayName(card)}</Text>
            {card.fullName ? (
              <TouchableOpacity onPress={onFullProfile} hitSlop={6} accessibilityRole="link">
                <Text style={styles.handle}>@{card.username}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.metaRow}>
              {card.city ? (
                <View style={styles.meta}>
                  <Ionicons name="location-sharp" size={14} color={colors.primary} />
                  <Text style={styles.metaText}>{card.city}</Text>
                </View>
              ) : null}
              {card.concertCount > 0 ? (
                <View style={styles.meta}>
                  <Ionicons name="ticket" size={13} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{t('buddy_concert_count', { count: card.concertCount })}</Text>
                </View>
              ) : null}
            </View>

            {shared.length > 0 && section('people', tu('buddy_going_together'), (
              <>
                {focus?.message ? (
                  <View style={styles.quote}>
                    <Ionicons name="chatbubble-ellipses" size={14} color={colors.primary} />
                    <Text style={styles.quoteText}>{focus.message}</Text>
                  </View>
                ) : null}
                {shared.map(eventRow)}
              </>
            ))}

            {section('sparkles', tu('buddy_section_why'), (
              <View style={styles.chips}>
                {reasonsFor(card, t).map(r => chip(r.icon, r.text, r.strong, r.icon))}
              </View>
            ))}

            {bio ? section('person', tu('buddy_section_about'), <Text style={styles.bio}>{bio}</Text>) : null}

            {genres.length > 0 && section('musical-notes', tu('buddy_section_genres'), (
              <View style={styles.chips}>
                {genres.map(g => chip(g, g, sharedGenres.has(g.toLowerCase())))}
              </View>
            ))}

            {artists.length > 0 && section('mic', tu('buddy_section_artists'), (
              <View style={styles.chips}>
                {artists.map(a => chip(a, a, sharedArtists.has(a), sharedArtists.has(a) ? 'heart' : null))}
              </View>
            ))}

            {concerts.length > 0 && section('ticket', tu('buddy_section_went'), concerts.map(eventRow))}
          </View>
        </ScrollView>

        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="chevron-down" size={22} color={onPhoto.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onMenu} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('mod_options_title')}>
            <Ionicons name="ellipsis-horizontal" size={20} color={onPhoto.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 18 }]}>
          {status === 'open' ? (
            <>
              <TouchableOpacity onPress={() => onDecide(false)} style={[styles.action, styles.passBtn]} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('buddy_pass')}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDecide(true)} style={[styles.action, styles.likeBtn]} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('buddy_like')}>
                <Ionicons name="heart" size={26} color="#fff" />
              </TouchableOpacity>
            </>
          ) : status === 'matched' ? (
            <TouchableOpacity onPress={onChat} style={styles.primary} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
              <Text style={styles.primaryText}>{t('buddy_send_message')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.seen}>{t('buddy_evaluated')}</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    hero: { width: '100%' },
    fallback: { alignItems: 'center', justifyContent: 'center' },
    initial: { fontFamily: fonts.heading, fontSize: 120, color: 'rgba(255,255,255,0.35)' },
    score: {
      position: 'absolute',
      right: 16,
      bottom: 28,
      backgroundColor: onPhoto.badge,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: `${colors.primary}73`,
    },
    scoreValue: { color: onPhoto.text, fontFamily: fonts.heading, fontSize: 20 },
    scoreLabel: { color: colors.primary, fontSize: 10, fontWeight: '600' },
    body: { paddingHorizontal: 20, marginTop: -36, gap: 6 },
    name: { color: colors.text, fontFamily: fonts.heading, fontSize: 30 },
    handle: { color: colors.textSecondary, fontSize: 14 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: colors.textSecondary, fontSize: 14 },
    section: { marginTop: 18, gap: 10 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    quote: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: `${colors.primary}14`,
      borderRadius: 14,
      padding: 12,
    },
    quoteText: { flex: 1, color: colors.text, fontStyle: 'italic', lineHeight: 20 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: '100%',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    chipStrong: { borderColor: `${colors.primary}80`, backgroundColor: `${colors.primary}14` },
    chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    bio: { color: colors.text, fontSize: 15, lineHeight: 22 },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 10,
    },
    eventThumb: { width: 54, height: 54, borderRadius: 12 },
    eventDate: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(6,6,18,0.6)',
      alignItems: 'center',
      paddingVertical: 2,
    },
    eventDay: { color: '#fff', fontFamily: fonts.headingBold, fontSize: 13, lineHeight: 15 },
    eventMonth: { color: '#fff', fontSize: 9, fontWeight: '700' },
    eventName: { color: colors.text, fontSize: 15, fontWeight: '700' },
    eventMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: onPhoto.badge,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actions: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 20,
      paddingTop: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 28,
      backgroundColor: `${colors.background}EB`,
    },
    action: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    passBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    likeBtn: { backgroundColor: colors.primary, boxShadow: `0 8px 16px ${colors.primary}8C` },
    primary: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
    },
    primaryText: { color: '#fff', fontFamily: fonts.headingBold, fontSize: 17 },
    seen: { color: colors.textSecondary, fontWeight: '600', paddingVertical: 20 },
  });
}
