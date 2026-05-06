import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions, Alert
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

const { width, height } = Dimensions.get('window');

// Türkiye Merkezi
const INITIAL_REGION = {
  latitude: 39.0,
  longitude: 35.0,
  latitudeDelta: 10,
  longitudeDelta: 10,
};

export default function MapScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      // Bütün etkinlikleri çek (haritada göstereceğimiz için şehir filtresi yok)
      const res = await API.get('/events');
      // Sadece enlem ve boylamı olan etkinlikleri filtrele
      const validEvents = res.data.filter(e => e.venueLatitude && e.venueLongitude);
      setEvents(validEvents);
    } catch (err) {
      console.log('Harita etkinlik yükleme hatası:', err.message);
      Alert.alert('Hata', 'Etkinlikler yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E1B4B', '#09090B']} style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Konser Haritası</Text>
        <Text style={styles.headerSub}>Çevrendeki etkinlikleri keşfet</Text>
      </LinearGradient>

      <MapView
        style={styles.map}
        initialRegion={INITIAL_REGION}
        userInterfaceStyle="dark"
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {events.map(event => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.venueLatitude,
              longitude: event.venueLongitude,
            }}
          >
            {/* Özel İkon */}
            <View style={styles.markerContainer}>
              <Text style={styles.markerEmoji}>📍</Text>
            </View>

            {/* Tıklanınca Açılan Baloncuk */}
            <Callout tooltip onPress={() => navigation.navigate('EventDetail', { event })}>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle} numberOfLines={1}>{event.name}</Text>
                {event.artistName && (
                  <Text style={styles.calloutArtist} numberOfLines={1}>🎤 {event.artistName}</Text>
                )}
                <Text style={styles.calloutDate}>
                  📅 {new Date(event.eventDate).toLocaleDateString('tr-TR')}
                </Text>
                <View style={styles.calloutBtn}>
                  <Text style={styles.calloutBtnText}>Detayları Gör ›</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: {
      flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background
    },
    header: {
      paddingTop: 64,
      paddingBottom: 20,
      paddingHorizontal: 24,
      elevation: 5,
      zIndex: 10,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    headerSub: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.6)',
    },
    map: {
      flex: 1,
      width: width,
      height: height,
    },
    markerContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerEmoji: {
      fontSize: 28,
    },
    calloutContainer: {
      backgroundColor: '#1E1B4B',
      borderRadius: 16,
      padding: 14,
      width: 220,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
    },
    calloutTitle: {
      color: '#fff',
      fontSize: 15,
      fontWeight: 'bold',
      marginBottom: 4,
      textAlign: 'center',
    },
    calloutArtist: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 13,
      marginBottom: 4,
    },
    calloutDate: {
      color: '#E94560',
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
    },
    calloutBtn: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    calloutBtnText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
  });
}
