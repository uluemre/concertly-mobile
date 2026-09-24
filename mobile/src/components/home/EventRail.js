// Ana sayfa: başlık + yatay kaydırılan küçük etkinlik kartları ("Bu hafta sonu",
// "Takip ettiğin sanatçılar"). Liste boşsa hiçbir şey çizmez.
import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';
import { parseEventDate } from '../../utils/time';
import { showArtistLine } from '../../utils/text';

const CARD_W = 150;

export default function EventRail({ title, emoji, accent, events, onPressEvent, onSeeAll }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!events || events.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <View style={[styles.accent, { backgroundColor: accent || colors.primary }]} />
          <Text style={styles.title}>{emoji ? `${emoji} ` : ''}{title}</Text>
        </View>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} hitSlop={10}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>{t('home_see_all_btn')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        horizontal
        data={events}
        keyExtractor={e => `rail-${title}-${e.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <RailCard item={item} lang={lang} styles={styles} onPress={() => onPressEvent(item)} />
        )}
      />
    </View>
  );
}

const RailCard = memo(function RailCard({ item, lang, styles, onPress }) {
  const d = parseEventDate(item.eventDate);
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const when = `${d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  const image = item.imageUrl || item.artistImageUrl;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <View style={styles.imageWrap}>
        {image
          ? <Image source={{ uri: image }} style={styles.image} />
          : <LinearGradient colors={['#7C3AED', '#E94560']} style={styles.image} />}
        <View style={styles.dateChip}>
          <Text style={styles.dateText}>{when}</Text>
        </View>
      </View>
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>
        {showArtistLine(item.artistName, item.name) ? item.artistName : (item.venueName || item.venueCity || '')}
      </Text>
    </TouchableOpacity>
  );
});

function createStyles(colors) {
  return StyleSheet.create({
    section: { marginTop: 22 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    accent: { width: 4, height: 20, borderRadius: 2 },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    seeAll: { fontSize: 13, fontWeight: '700' },
    list: { paddingHorizontal: 20, gap: 12 },
    card: { width: CARD_W },
    imageWrap: { width: CARD_W, height: 100, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.card },
    image: { width: '100%', height: '100%' },
    dateChip: {
      position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(10,10,20,0.78)',
      borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    },
    dateText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    name: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 8, lineHeight: 18 },
    meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  });
}
