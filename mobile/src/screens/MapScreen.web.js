import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { launchCityOrNull, useLaunchCities } from '../constants/cities';
import { parseEventDate } from '../utils/time';

/** Mekanı OpenStreetMap'te işaretli gösteren adres. */
const osmUrl = (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;

// Koordinatı olmayan (ya da açıkça bozuk 0,0) mekanda harita bağlantısı gösterilmez
const hasCoords = (e) => Number.isFinite(e?.venueLatitude) && Number.isFinite(e?.venueLongitude)
  && !(e.venueLatitude === 0 && e.venueLongitude === 0);

// react-native-maps'in web karşılığı yok. Metro bu dosyayı yalnızca web paketinde
// kullanır; iOS ve Android MapScreen.js ile gerçek haritayı gösterir. Web'de yaklaşan
// etkinlikler şehre göre listelenir, mekan "Haritada aç" ile OpenStreetMap'te açılır.
export default function MapScreen({ navigation }) {
  const { colors } = useTheme();
  const launchCities = useLaunchCities();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';

  // Varsayılan şehir: Ana sayfa / Etkinlikler ile aynı (kullanıcının şehri, lansman şehriyse)
  const [city, setCity] = useState(launchCityOrNull(session.userCity));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const latestRequest = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setLoadError(false);
    const params = ['upcoming=true'];
    if (city) params.push(`city=${encodeURIComponent(city)}`);
    API.get(`/events?${params.join('&')}`)
      .then(({ data }) => {
        if (requestId !== latestRequest.current) return;
        const list = Array.isArray(data) ? data : [];
        // Tarih sırası; aynı saatte id ile sabit
        list.sort((a, b) => (parseEventDate(a.eventDate) - parseEventDate(b.eventDate)) || (a.id - b.id));
        setEvents(list);
      })
      .catch(() => {
        if (requestId !== latestRequest.current) return;
        setEvents([]);
        setLoadError(true);
      })
      .finally(() => {
        if (requestId === latestRequest.current) setLoading(false);
      });
  }, [city]);

  const cities = [null, ...launchCities];

  const formatDate = (value) => {
    const d = parseEventDate(value);
    if (Number.isNaN(d?.getTime?.())) return '';
    const day = d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' });
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrFallback(navigation)}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('map_title')}</Text>
        <Text style={styles.subtitle}>
          {loading ? t('map_loading') : t('map_events_count', { count: events.length })}
        </Text>
        <Text style={styles.notice}>{t('map_web_note')}</Text>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {cities.map((c) => {
            const active = c === city;
            return (
              <TouchableOpacity
                key={c || 'all'}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCity(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c || t('map_radius_all')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.card}
              onPress={() => openEvent(navigation, event)}
              accessibilityRole="button"
              activeOpacity={0.85}
            >
              <Text style={styles.name} numberOfLines={2}>{event.name}</Text>
              {!!event.artistName && event.artistName !== event.name && (
                <View style={styles.detailRow}>
                  <Ionicons name="mic-outline" size={13} color={colors.text} />
                  <Text style={[styles.artist, styles.detailText]} numberOfLines={1}>{event.artistName}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons name="calendar-clear-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.detail, styles.detailText]}>{formatDate(event.eventDate)}</Text>
              </View>
              {!!(event.venueName || event.venueCity) && (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.detail, styles.detailText]} numberOfLines={2}>
                    {[event.venueName, event.venueCity].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}
              {hasCoords(event) && (
                <TouchableOpacity
                  style={styles.mapLink}
                  onPress={() => Linking.openURL(osmUrl(event.venueLatitude, event.venueLongitude)).catch(() => {})}
                  accessibilityRole="link"
                  accessibilityLabel={`${t('map_open_osm')}: ${event.venueName || ''}`}
                >
                  <Text style={styles.mapLinkText}>{t('map_open_osm')} ↗</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
          {!events.length && (
            <Text style={styles.empty}>{loadError ? t('load_failed') : t('map_empty')}</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 48, paddingHorizontal: 20, paddingBottom: 16 },
    backButton: {
      alignSelf: 'flex-start', marginBottom: 12,
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    backText: { color: colors.text, fontSize: 14, fontWeight: '700' },
    title: { color: colors.text, fontSize: 24, fontWeight: '800' },
    subtitle: { color: colors.textSecondary, marginTop: 4 },
    notice: { color: colors.textSecondary, fontSize: 12, marginTop: 10, lineHeight: 17 },
    filterBar: { borderBottomWidth: 1, borderBottomColor: colors.border },
    filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16, gap: 10 },
    card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16 },
    name: { color: colors.text, fontSize: 16, fontWeight: '700' },
    artist: { color: colors.text, marginTop: 4, opacity: 0.85 },
    detail: { color: colors.textSecondary, marginTop: 4 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    detailText: { marginTop: 0, flexShrink: 1 },
    mapLink: {
      alignSelf: 'flex-start', marginTop: 10,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
      borderWidth: 1, borderColor: colors.primary,
    },
    mapLinkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
    empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 24 },
  });
}
