import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import EventImage from './EventImage';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { parseEventDate } from '../utils/time';
import { showArtistLine } from '../utils/text';
import { ticketSiteHost } from '../services/concerts';

/**
 * Uygulamanın ortak etkinlik kartı.
 *
 * variant:
 *  - "poster": tam genişlik, büyük görsel; ad ve tarih görselin üstünde (1×1)
 *  - "row":    solda küçük görsel, sağda bilgiler (liste)
 *  - "tile":   iki sütunlu ızgara için dikey kart (2×2)
 *
 * Bilgi sırası her varyantta aynı: tarih/saat → ad → sanatçı → mekan → tür + bilet.
 */
function EventCard({ item, variant = 'row', onPress, genericImages, style, dimmed = false }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const d = parseEventDate(item.eventDate);
  const valid = !isNaN(d);
  const day = valid ? d.getDate() : '';
  const month = valid ? d.toLocaleDateString(locale, { month: 'short' }).replace('.', '').toLocaleUpperCase(locale) : '';
  const weekday = valid ? d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').toLocaleUpperCase(locale) : '';
  const time = valid ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
  const place = [item.venueName, item.venueCity].filter(Boolean).join(' · ');
  const links = Array.isArray(item.ticketLinks) ? item.ticketLinks : [];
  const ticketText = links.length > 1
    ? t('detail_ticket_on_sites', { count: links.length })
    : links.length === 1 ? (links[0].label || ticketSiteHost(links[0].url)) : null;
  const artistLine = showArtistLine(item.artistName, item.name) ? item.artistName : null;

  const dateBadge = (
    <View style={styles.dateBadge}>
      <Text style={styles.dateBadgeDay}>{day}</Text>
      <Text style={styles.dateBadgeMonth}>{month}</Text>
    </View>
  );

  const footer = (item.genre || ticketText || item.isVerified) ? (
    <View style={styles.footerRow}>
      {item.genre ? (
        <View style={styles.genrePill}>
          <Text style={styles.genrePillText} numberOfLines={1}>{item.genre}</Text>
        </View>
      ) : null}
      {item.isVerified ? <Ionicons name="checkmark-circle" size={15} color={colors.accent || '#00D4AA'} /> : null}
      <View style={{ flex: 1 }} />
      {ticketText && variant !== 'tile' ? (
        <View style={styles.ticketTag}>
          <Ionicons name="ticket-outline" size={13} color={colors.primary} />
          <Text style={styles.ticketTagText} numberOfLines={1}>{ticketText}</Text>
        </View>
      ) : null}
    </View>
  ) : null;

  if (variant === 'poster') {
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={[styles.posterCard, dimmed && styles.dimmed, style]}>
        <EventImage key={item.id} item={item} genericImages={genericImages} style={styles.posterImage} initialsSize={48}>
          <LinearGradient
            colors={['transparent', 'rgba(6,6,18,0.55)', 'rgba(6,6,18,0.95)']}
            style={styles.posterScrim}
          />
          {dateBadge}
          {ticketText ? (
            <View style={styles.posterTicket}>
              <Ionicons name="ticket" size={12} color="#fff" />
              <Text style={styles.posterTicketText} numberOfLines={1}>{ticketText}</Text>
            </View>
          ) : null}
          <View style={styles.posterText}>
            <Text style={styles.posterWhen}>{weekday} · {time}</Text>
            <Text style={styles.posterName} numberOfLines={2}>{item.name}</Text>
            {artistLine ? (
              <View style={styles.metaRow}>
                <Ionicons name="mic" size={13} color="rgba(255,255,255,0.8)" />
                <Text style={styles.posterMeta} numberOfLines={1}>{artistLine}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              {!!place && <Ionicons name="location" size={13} color="rgba(255,255,255,0.8)" />}
              <Text style={styles.posterMeta} numberOfLines={1}>{place}</Text>
              {item.isVerified ? <Ionicons name="checkmark-circle" size={15} color={colors.accent || '#00D4AA'} /> : null}
              {item.genre ? (
                <View style={styles.posterGenre}>
                  <Text style={styles.posterGenreText} numberOfLines={1}>{item.genre}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </EventImage>
      </TouchableOpacity>
    );
  }

  if (variant === 'tile') {
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={[styles.tileCard, dimmed && styles.dimmed, style]}>
        <EventImage key={item.id} item={item} genericImages={genericImages} style={styles.tileImage} initialsSize={30}>
          {dateBadge}
          {links.length > 1 ? (
            <View style={styles.tileTicketDot}>
              <Ionicons name="ticket" size={11} color="#fff" />
              <Text style={styles.tileTicketDotText}>{links.length}</Text>
            </View>
          ) : null}
        </EventImage>
        <View style={styles.tileBody}>
          <Text style={styles.cardWhen} numberOfLines={1}>{weekday} · {time}</Text>
          <Text style={styles.tileName} numberOfLines={2}>{item.name}</Text>
          {!!(item.venueCity || item.venueName) && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.tileMeta} numberOfLines={1}>{item.venueName || item.venueCity}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.rowCard, dimmed && styles.dimmed, style]}>
      <EventImage key={item.id} item={item} genericImages={genericImages} style={styles.rowThumb} initialsSize={24}>
        {dateBadge}
      </EventImage>
      <View style={styles.rowBody}>
        <Text style={styles.cardWhen} numberOfLines={1}>{weekday} · {time}</Text>
        <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
        {artistLine ? (
          <View style={styles.metaRow}>
            <Ionicons name="mic-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{artistLine}</Text>
          </View>
        ) : null}
        {!!place && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{place}</Text>
          </View>
        )}
        {footer}
      </View>
    </TouchableOpacity>
  );
}

export default memo(EventCard);

function createStyles(colors) {
  return StyleSheet.create({
    dimmed: { opacity: 0.6 },

    // ortak
    dateBadge: {
      position: 'absolute', top: 8, left: 8, minWidth: 40,
      paddingVertical: 4, paddingHorizontal: 7, borderRadius: 11,
      alignItems: 'center', backgroundColor: 'rgba(8,8,20,0.74)',
    },
    dateBadgeDay: { color: '#fff', fontSize: 17, lineHeight: 19, fontWeight: '900' },
    dateBadgeMonth: { color: 'rgba(255,255,255,0.85)', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
    cardWhen: { color: colors.primary, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    metaText: { flex: 1, color: colors.textSecondary, fontSize: 12.5 },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    genrePill: {
      maxWidth: 110, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
      backgroundColor: colors.primary + '1F',
    },
    genrePillText: { color: colors.primary, fontSize: 10.5, fontWeight: '800' },
    ticketTag: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140 },
    ticketTagText: { color: colors.primary, fontSize: 11.5, fontWeight: '800' },

    // liste
    rowCard: {
      flexDirection: 'row', gap: 12, padding: 10, marginBottom: 12,
      borderRadius: 18, borderWidth: 1,
      backgroundColor: colors.card, borderColor: colors.border,
    },
    rowThumb: { width: 96, height: 108, borderRadius: 14 },
    rowBody: { flex: 1, paddingVertical: 2 },
    rowName: { color: colors.text, fontSize: 15.5, lineHeight: 20, fontWeight: '800', marginBottom: 4 },

    // büyük (poster)
    posterCard: {
      marginBottom: 16, borderRadius: 22, overflow: 'hidden',
      backgroundColor: colors.card,
    },
    posterImage: { width: '100%', aspectRatio: 16 / 11 },
    posterScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '78%' },
    posterText: { position: 'absolute', left: 14, right: 14, bottom: 14 },
    posterWhen: { color: '#FFD166', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
    posterName: { color: '#fff', fontSize: 22, lineHeight: 26, fontWeight: '900', marginBottom: 6 },
    posterMeta: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13 },
    posterTicket: {
      position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primary,
    },
    posterTicketText: { color: '#fff', fontSize: 11.5, fontWeight: '900', maxWidth: 150 },
    posterGenre: {
      maxWidth: 110, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    posterGenreText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },

    // ızgara (tile)
    tileCard: {
      marginBottom: 12, borderRadius: 18, overflow: 'hidden', borderWidth: 1,
      backgroundColor: colors.card, borderColor: colors.border,
    },
    tileImage: { width: '100%', aspectRatio: 1 },
    tileTicketDot: {
      position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primary,
    },
    tileTicketDotText: { color: '#fff', fontSize: 11, fontWeight: '900' },
    tileBody: { padding: 10 },
    tileName: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: '800', minHeight: 36, marginBottom: 4 },
    tileMeta: { flex: 1, color: colors.textSecondary, fontSize: 12 },
  });
}
