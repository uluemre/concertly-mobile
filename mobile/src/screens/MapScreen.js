import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions, ScrollView, Animated,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import Supercluster from 'supercluster';
import { pinImage, clusterImage } from '../components/map/markerImages';
import { Ionicons } from '@expo/vector-icons';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { parseEventDate, dateLocale } from '../utils/time';
import { openEvent } from '../navigation/navHelpers';

const { width, height } = Dimensions.get('window');

const TURKEY_CENTER = { latitude: 39.0, longitude: 35.0, latitudeDelta: 10, longitudeDelta: 10 };

const RADIUS_VALUES = [null, 10, 25, 50];

const GENRE_COLORS = {
  rock: '#E94560',
  pop: '#7C3AED',
  jazz: '#F5A623',
  elektronik: '#00D4AA',
  electronic: '#00D4AA',
  rap: '#3B82F6',
  default: '#E94560',
};

function getMarkerColor(genre) {
  if (!genre) return GENRE_COLORS.default;
  const g = genre.toLowerCase();
  for (const key of Object.keys(GENRE_COLORS)) {
    if (g.includes(key)) return GENRE_COLORS[key];
  }
  return GENRE_COLORS.default;
}

// Bölgenin yakınlaştırma düzeyi (supercluster 0–20 ölçeği)
function regionZoom(region) {
  return Math.max(0, Math.min(20, Math.round(Math.log2(360 / Math.max(region.longitudeDelta, 1e-6)))));
}

function regionBBox(region) {
  return [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ];
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// Kümeler yalnız yakınlaştırma düzeyi ya da görünen alan belirgin değişince yeniden hesaplanır
function sameView(a, b) {
  if (!a || !b) return false;
  if (regionZoom(a) !== regionZoom(b)) return false;
  return Math.abs(a.latitude - b.latitude) < a.latitudeDelta * 0.15
    && Math.abs(a.longitude - b.longitude) < a.longitudeDelta * 0.15;
}

export default function MapScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useLanguage();
  const mapRef = useRef(null);

  const RADIUS_OPTIONS = useMemo(() => [
    { label: t('map_radius_all'), value: null },
    { label: '10 km', value: 10 },
    { label: '25 km', value: 25 },
    { label: '50 km', value: 50 },
  ], [t]);

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const bottomAnim = useRef(new Animated.Value(220)).current;

  useEffect(() => {
    Promise.all([fetchEvents(), requestLocation()]).finally(() => setLoading(false));
  }, []);

  const fetchEvents = async () => {
    try {
      // Yalnızca yaklaşan etkinlikler (N-18) — eskiden filtresiz geldiği için geçmişler de pinleniyordu
      const res = await API.get('/events', { params: { upcoming: true } });
      setAllEvents(res.data.filter(e => e.venueLatitude && e.venueLongitude));
    } catch (err) {
      console.log('Harita yükleme hatası:', err.message);
    }
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationDenied(true); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {
      setLocationDenied(true);
    }
  };

  const eventsWithDistance = useMemo(() => {
    return allEvents.map(e => ({
      ...e,
      distanceKm: userLocation
        ? haversineKm(userLocation.latitude, userLocation.longitude, e.venueLatitude, e.venueLongitude)
        : null,
    }));
  }, [allEvents, userLocation]);

  const filteredEvents = useMemo(() => {
    if (!selectedRadius) return eventsWithDistance;
    return eventsWithDistance.filter(e => e.distanceKm !== null && e.distanceKm <= selectedRadius);
  }, [eventsWithDistance, selectedRadius]);

  // Mekân başına TEK işaretçi. Eskiden her etkinlik ayrı, özel görünümlü bir işaretçiydi:
  // ~1300 etkinlik / ~300 mekânda iOS her karede hepsini yeniden çizip haritayı donduruyordu.
  const venueGroups = useMemo(() => {
    const byVenue = new Map();
    for (const e of filteredEvents) {
      const key = `${Number(e.venueLatitude).toFixed(5)},${Number(e.venueLongitude).toFixed(5)}`;
      let g = byVenue.get(key);
      if (!g) {
        g = { key, latitude: e.venueLatitude, longitude: e.venueLongitude, events: [] };
        byVenue.set(key, g);
      }
      g.events.push(e);
    }
    for (const g of byVenue.values()) {
      g.events.sort((a, b) => parseEventDate(a.eventDate) - parseEventDate(b.eventDate));
    }
    return [...byVenue.values()];
  }, [filteredEvents]);

  // Uzaklaşınca yakın mekânlar tek yuvarlakta toplanır (içindeki etkinlik sayısıyla);
  // ekranda bir anda çizilen işaretçi sayısı düşer, harita akıcı kalır.
  const clusterIndex = useMemo(() => {
    const index = new Supercluster({
      radius: 56,
      maxZoom: 15,
      map: (p) => ({ events: p.events }),
      reduce: (acc, p) => { acc.events += p.events; },
    });
    index.load(venueGroups.map(g => ({
      type: 'Feature',
      properties: { key: g.key, events: g.events.length },
      geometry: { type: 'Point', coordinates: [Number(g.longitude), Number(g.latitude)] },
    })));
    return index;
  }, [venueGroups]);

  const [region, setRegion] = useState(null);
  const groupByKey = useMemo(() => new Map(venueGroups.map(g => [g.key, g])), [venueGroups]);
  const clusters = useMemo(() => {
    // Harita ilk bölge bildirimini göndermeden önce açılış bölgesi kullanılır
    const r = region || (userLocation ? { ...userLocation, latitudeDelta: 0.3, longitudeDelta: 0.3 } : TURKEY_CENTER);
    return clusterIndex.getClusters(regionBBox(r), regionZoom(r));
  }, [clusterIndex, region, userLocation]);

  const onRegionChangeComplete = useCallback((next) => {
    setRegion(prev => (sameView(prev, next) ? prev : next));
  }, []);

  const handleClusterPress = useCallback((cluster) => {
    if (!mapRef.current) return;
    const [longitude, latitude] = cluster.geometry.coordinates;
    const zoom = Math.min(clusterIndex.getClusterExpansionZoom(cluster.id) + 1, 18);
    const delta = 360 / Math.pow(2, zoom);
    mapRef.current.animateToRegion({ latitude, longitude, latitudeDelta: delta, longitudeDelta: delta }, 450);
  }, [clusterIndex]);

  const venueKeyOf = (e) => e && `${Number(e.venueLatitude).toFixed(5)},${Number(e.venueLongitude).toFixed(5)}`;
  const selectedVenueKey = venueKeyOf(selectedEvent);
  const selectedVenueCount = selectedEvent
    ? (venueGroups.find(g => g.key === selectedVenueKey)?.events.length || 1)
    : 0;

  const nearbySorted = useMemo(() => {
    if (!userLocation) return filteredEvents;
    return [...filteredEvents].sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }, [filteredEvents, userLocation]);

  const handleMarkerPress = useCallback((event, focus = false) => {
    setSelectedEvent(event);
    // Listeden seçilen etkinliğin mekânı bir kümenin içinde kalmış olabilir: oraya yaklaş
    if (focus && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: Number(event.venueLatitude), longitude: Number(event.venueLongitude),
        latitudeDelta: 0.02, longitudeDelta: 0.02,
      }, 450);
    }
    Animated.spring(bottomAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
  }, [bottomAnim]);

  const handleMapPress = useCallback(() => {
    if (!selectedEvent) return;
    Animated.timing(bottomAnim, { toValue: 220, duration: 220, useNativeDriver: true }).start(() => setSelectedEvent(null));
  }, [selectedEvent, bottomAnim]);

  const goToUserLocation = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }, 600);
  };

  const initialRegion = useMemo(() => {
    if (userLocation) {
      return { ...userLocation, latitudeDelta: 0.3, longitudeDelta: 0.3 };
    }
    return TURKEY_CENTER;
  }, [userLocation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('map_loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t('map_title')}</Text>
            <Text style={styles.headerSub}>
              {t('map_events_count', { count: filteredEvents.length })}
              {locationDenied ? ` · ${t('map_no_location')}` : userLocation ? ` · ${t('map_location_found')}` : ''}
            </Text>
          </View>
          {userLocation && (
            <TouchableOpacity style={styles.locateBtn} onPress={goToUserLocation} activeOpacity={0.8} accessibilityRole="button">
              <Text style={styles.locateBtnText}>{t('map_go_location')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* RADIUS FİLTRELERİ */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {RADIUS_OPTIONS.map(opt => {
            const active = selectedRadius === opt.value;
            const disabled = opt.value !== null && !userLocation;
            return (
              <TouchableOpacity
                key={String(opt.value)}
                style={[styles.filterChip, active && styles.filterChipActive, disabled && styles.filterChipDisabled]}
                onPress={() => !disabled && setSelectedRadius(opt.value)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* HARİTA */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        userInterfaceStyle="dark"
        showsUserLocation={true}
        showsMyLocationButton={false}
        onPress={handleMapPress}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {/* Mesafe dairesi */}
        {userLocation && selectedRadius && (
          <Circle
            center={userLocation}
            radius={selectedRadius * 1000}
            strokeColor="rgba(233,69,96,0.5)"
            fillColor="rgba(233,69,96,0.07)"
            strokeWidth={1.5}
          />
        )}

        {/* İşaretçiler hazır PNG (bkz. markerImages): özel görünüm çizimi yok, harita donmaz */}
        {clusters.map(feature => {
          if (feature.properties.cluster) {
            const [longitude, latitude] = feature.geometry.coordinates;
            const count = feature.properties.events;
            return (
              <Marker
                key={`cluster-${feature.id}`}
                coordinate={{ latitude, longitude }}
                image={clusterImage(count)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={() => handleClusterPress(feature)}
                accessibilityLabel={t('map_cluster_a11y', { count })}
              />
            );
          }
          const group = groupByKey.get(feature.properties.key);
          if (!group) return null;
          const first = group.events[0];
          const isSelected = selectedVenueKey === group.key;
          return (
            <Marker
              key={group.key}
              coordinate={{ latitude: group.latitude, longitude: group.longitude }}
              image={pinImage(first.genre, isSelected)}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={isSelected ? 10 : 1}
              tracksViewChanges={false}
              onPress={() => handleMarkerPress(first)}
              accessibilityLabel={first.venueName || first.name}
            />
          );
        })}
      </MapView>

      {/* ALT KAYAN PANEL */}
      {selectedEvent && (
        <Animated.View style={[styles.bottomCard, { transform: [{ translateY: bottomAnim }] }]}>
          <View style={[styles.bottomCardHandle, { backgroundColor: colors.border }]} />

          <View style={styles.bottomCardBody}>
            <View style={[styles.bottomCardDot, { backgroundColor: getMarkerColor(selectedEvent.genre) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomCardTitle} numberOfLines={2}>{selectedEvent.name}</Text>
              {selectedEvent.artistName && (
                <View style={styles.subRow}>
                  <Ionicons name="mic-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.bottomCardSub, styles.subText]}>{selectedEvent.artistName}</Text>
                </View>
              )}
              <View style={styles.subRow}>
                <Ionicons name="calendar-clear-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.bottomCardSub, styles.subText]}>
                  {parseEventDate(selectedEvent.eventDate).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
              {selectedEvent.venueName && (
                <View style={styles.subRow}>
                  <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.bottomCardSub, styles.subText]}>{selectedEvent.venueName}</Text>
                </View>
              )}
              {selectedEvent.distanceKm !== null && (
                <View style={[styles.subRow, { marginTop: 4 }]}>
                  <Ionicons name="location" size={13} color={colors.primary} />
                  <Text style={[styles.bottomCardDistance, { marginTop: 0 }]}>
                    {formatDistance(selectedEvent.distanceKm)} {t('map_away')}
                  </Text>
                </View>
              )}
              {selectedVenueCount > 1 && !!selectedEvent.venueId && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('VenueProfile', { venueId: selectedEvent.venueId, venueName: selectedEvent.venueName })}
                  style={[styles.subRow, { marginTop: 6 }]}
                  accessibilityRole="link"
                >
                  <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                  <Text style={[styles.bottomCardDistance, { marginTop: 0 }]}>
                    {t('map_venue_events', { count: selectedVenueCount })}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.bottomCardBtn, { backgroundColor: getMarkerColor(selectedEvent.genre) }]}
            onPress={() => openEvent(navigation, selectedEvent)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.bottomCardBtnText}>{t('map_details')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* YAKINDAKI ETKİNLİKLER LİSTESİ (konum varsa, panel kapalıysa) */}
      {!selectedEvent && userLocation && nearbySorted.length > 0 && (
        <View style={styles.nearbyStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
            {nearbySorted.slice(0, 8).map(event => (
              <TouchableOpacity
                key={event.id}
                style={styles.nearbyCard}
                onPress={() => handleMarkerPress(event, true)}
                activeOpacity={0.85}
              >
                <View style={[styles.nearbyDot, { backgroundColor: getMarkerColor(event.genre) }]} />
                <Text style={styles.nearbyName} numberOfLines={1}>{event.name}</Text>
                {event.distanceKm !== null && (
                  <Text style={styles.nearbyDist}>{formatDistance(event.distanceKm)} {t('map_away')}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
    loadingText: { color: colors.textSecondary, fontSize: 14 },

    header: {
      paddingTop: 56,
      paddingBottom: 12,
      paddingHorizontal: 20,
      zIndex: 10,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
    locateBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    locateBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    filterScroll: { marginBottom: 4 },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipDisabled: { opacity: 0.4 },
    filterChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    filterChipTextActive: { color: '#fff' },

    map: { flex: 1, width },

    subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
    bottomCardBody: {
      flexDirection: 'row',
      gap: 14,
      marginBottom: 16,
    },
    bottomCardDot: {
      width: 6,
      borderRadius: 3,
      alignSelf: 'stretch',
    },
    bottomCardTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
      lineHeight: 22,
    },
    bottomCardSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 3,
    },
    bottomCardDistance: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '700',
      marginTop: 4,
    },
    bottomCardBtn: {
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
    },
    bottomCardBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

    nearbyStrip: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: 12,
      paddingBottom: 28,
      backgroundColor: 'rgba(10,10,20,0.92)',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.08)',
    },
    nearbyCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 140,
      maxWidth: 180,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    nearbyDot: { width: 8, height: 8, borderRadius: 4 },
    nearbyName: { fontSize: 13, fontWeight: '700', color: colors.text },
    nearbyDist: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  });
}
