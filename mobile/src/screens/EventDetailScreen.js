import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useTheme } from '../theme';

// İki nokta arasındaki mesafeyi metre cinsinden hesaplar (Haversine formülü)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function EventDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { event } = route.params;
  const [verifying, setVerifying] = useState(false);

  const handlePostAt = async () => {
    // 1 — Konser günü mü?
    const eventDate = new Date(event.eventDate);
    const today = new Date();
    const isSameDay =
      eventDate.getFullYear() === today.getFullYear() &&
      eventDate.getMonth() === today.getMonth() &&
      eventDate.getDate() === today.getDate();

   // if (!isSameDay) {
   //   Alert.alert(
   //     '📅 Henüz değil!',
   //     `Bu etkinlik ${eventDate.toLocaleDateString...`,
   //     [{ text: 'Tamam' }]
   //   );
   //   return;
   // }

    // 2 — Mekan koordinatları var mı?
    if (!event.venueLatitude || !event.venueLongitude) {
      // Mekan koordinatı yoksa direkt post ekranına geç
      navigation.navigate('CreatePost', { event });
      return;
    }

    // 3 — Konum izni al
    setVerifying(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('📍 Konum İzni', 'Doğrulama için konum iznine ihtiyacımız var.', [{ text: 'Tamam' }]);
        setVerifying(false);
        return;
      }

      // 4 — Konumu al
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      // 5 — Mesafeyi hesapla
      const distance = getDistanceInMeters(
        latitude, longitude,
        event.venueLatitude, event.venueLongitude
      );

      const distanceFormatted = distance < 1000
        ? `${Math.round(distance)} metre`
        : `${(distance / 1000).toFixed(1)} km`;

      if (distance <= 200) {
        // ✅ Yakın — post ekranına geç
        Alert.alert(
          '✅ Doğrulandı!',
          `Mekana ${distanceFormatted} uzaklıkta tespit edildin. Post atabilirsin! 🎉`,
          [{ text: 'Post At', onPress: () => navigation.navigate('CreatePost', { event, verified: true }) }]
        );
      } else {
        // ❌ Uzak — engelle
        Alert.alert(
          '📍 Çok uzaktasın!',
          `Mekana ${distanceFormatted} uzaklıktasın. Post atabilmek için mekana en az 200 metre yakın olman gerekiyor.`,
          [{ text: 'Tamam' }]
        );
      }
    } catch (err) {
      Alert.alert('Hata', 'Konum alınamadı, tekrar dene.');
      console.log(err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.heroSection}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.heroEmoji}>🎪</Text>
        <Text style={styles.heroTitle}>{event.name}</Text>
        <View style={styles.approvedBadge}>
          <Text style={styles.approvedText}>
            {event.isApproved ? '✅ Onaylandı' : '⏳ Onay Bekliyor'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>📋 Etkinlik Hakkında</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>📅 Tarih & Saat</Text>
          <Text style={styles.infoValue}>
            {new Date(event.eventDate).toLocaleDateString('tr-TR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </Text>
          <Text style={styles.infoValueSub}>
            🕐 {new Date(event.eventDate).toLocaleTimeString('tr-TR', {
              hour: '2-digit', minute: '2-digit'
            })}
          </Text>
        </View>

        {event.artistName && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>🎤 Sanatçı</Text>
            <Text style={styles.infoValue}>{event.artistName}</Text>
          </View>
        )}

        {event.venueName && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>📍 Mekan</Text>
            <Text style={styles.infoValue}>{event.venueName}</Text>
            <Text style={styles.infoValueSub}>{event.venueCity}, {event.venueCountry}</Text>
          </View>
        )}

        {/* KONUM DOĞRULAMA BİLGİSİ */}
        <View style={styles.verifyInfoCard}>
          <Text style={styles.verifyInfoEmoji}>📍</Text>
          <View style={styles.verifyInfoText}>
            <Text style={styles.verifyInfoTitle}>Konum Doğrulama Aktif</Text>
            <Text style={styles.verifyInfoSub}>
              Post atabilmek için konser günü mekana 200m yakın olman gerekiyor.
            </Text>
          </View>
        </View>

        {/* POST AT BUTONU */}
        {verifying ? (
          <View style={styles.verifyingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.verifyingText}>Konumun doğrulanıyor...</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={handlePostAt}>
            <LinearGradient
              colors={['#F5A623', '#E94560']}
              style={styles.actionButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.actionButtonText}>🎵 Post At</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroSection: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backButton: { alignSelf: 'flex-start', marginBottom: 20 },
  backText: { fontSize: 16, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  heroEmoji: { fontSize: 64, marginBottom: 12 },
  heroTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  approvedBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  approvedText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  content: { padding: 16, gap: 12 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  description: { fontSize: 15, color: colors.text, lineHeight: 22 },
  infoValue: { fontSize: 16, color: colors.text, fontWeight: '600' },
  infoValueSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  verifyInfoCard: {
    backgroundColor: '#1A2A1A',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#00D4AA44',
  },
  verifyInfoEmoji: { fontSize: 28 },
  verifyInfoText: { flex: 1 },
  verifyInfoTitle: { color: '#00D4AA', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  verifyInfoSub: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  verifyingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  verifyingText: { color: colors.textSecondary, fontSize: 14 },
  actionButton: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
