import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
  Linking
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import API from '../services/api';
import { useTheme } from '../theme';

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
  const [attendLoading, setAttendLoading] = useState(false);
  const [attendance, setAttendance] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // ── Katılım ──────────────────────────────────────────────────────────────
  const handleAttend = async (status) => {
    if (attendLoading) return;
    setAttendLoading(true);

    if (attendance === status) {
      try {
        await API.delete(`/events/${event.id}/attendance?userId=${global.userId}`);
        setAttendance(null);
      } catch (err) {
        Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
        console.log(err.message);
      } finally {
        setAttendLoading(false);
      }
      return;
    }

    try {
      await API.post(
        `/events/${event.id}/attendance?userId=${global.userId}&status=${status}`
      );
      setAttendance(status);
    } catch (err) {
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
      console.log(err.message);
    } finally {
      setAttendLoading(false);
    }
  };

  // ── Konum doğrula & post at ───────────────────────────────────────────────
  const handlePostAt = async () => {
    if (!event.venueLatitude || !event.venueLongitude) {
      navigation.navigate('CreatePost', { event });
      return;
    }

    setVerifying(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          '📍 Konum İzni',
          'Doğrulama için konum iznine ihtiyacımız var.',
          [{ text: 'Tamam' }]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;

      const distance = getDistanceInMeters(
        latitude, longitude,
        event.venueLatitude, event.venueLongitude
      );

      const distanceFormatted =
        distance < 1000
          ? `${Math.round(distance)} metre`
          : `${(distance / 1000).toFixed(1)} km`;

      if (distance <= 200) {
        Alert.alert(
          '✅ Doğrulandı!',
          `Mekana ${distanceFormatted} uzaklıkta tespit edildin. Post atabilirsin! 🎉`,
          [{
            text: 'Post At',
            onPress: () => navigation.navigate('CreatePost', { event, verified: true }),
          }]
        );
      } else {
        Alert.alert(
          '📍 Çok uzaktasın!',
          `Mekana ${distanceFormatted} uzaklıktasın. Post atabilmek için en az 200m yakın olman gerekiyor.`,
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
      {/* HERO */}
      {event.imageUrl ? (
        <View>
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
            placeholder={require('../../assets/icon.png')}
            onError={(error) => {
              console.log('Expo Image load error for URL:', event.imageUrl, error);
              setImageError(true);
              setImageLoading(false);
            }}
            onLoad={() => {
              console.log('Expo Image loaded successfully:', event.imageUrl);
              setImageLoading(false);
            }}
            onLoadStart={() => setImageLoading(true)}
            cachePolicy="memory-disk"
            transition={300}
          />

          {imageLoading && !imageError && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {imageError && (
            <View style={styles.imageErrorOverlay}>
              <Text style={styles.imageErrorText}>Resim yüklenemedi</Text>
            </View>
          )}

          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.heroOverlay}>
            <View style={styles.heroTopActions}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backText}>← Geri</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.heroTitle}>{event.name}</Text>

            {event.genre && (
              <View style={styles.genreBadge}>
                <Text style={styles.genreText}>🎵 {event.genre}</Text>
              </View>
            )}
          </LinearGradient>
        </View>
      ) : (
        <LinearGradient colors={['#1E1B4B', '#09090B']} style={styles.heroSection}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>

          <Text style={styles.heroEmoji}>🎪</Text>
          <Text style={styles.heroTitle}>{event.name}</Text>
        </LinearGradient>
      )}

      <View style={styles.content}>

        {/* KATILIM BUTONLARI */}
        <View style={styles.attendanceRow}>
          <TouchableOpacity
            style={[styles.attendBtn, attendance === 'GOING' && styles.attendBtnActive]}
            onPress={() => handleAttend('GOING')}
            disabled={attendLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.attendBtnEmoji}>✅</Text>
            <Text style={[
              styles.attendBtnText,
              attendance === 'GOING' && styles.attendBtnTextActive,
            ]}>
              Gidiyorum
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attendBtn, attendance === 'INTERESTED' && styles.attendBtnActiveYellow]}
            onPress={() => handleAttend('INTERESTED')}
            disabled={attendLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.attendBtnEmoji}>⭐</Text>
            <Text style={[
              styles.attendBtnText,
              attendance === 'INTERESTED' && styles.attendBtnTextActiveYellow,
            ]}>
              İlgileniyorum
            </Text>
          </TouchableOpacity>
        </View>

        {/* ETKİNLİK HAKKINDA */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>📋 Etkinlik Hakkında</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        {/* TARİH & SAAT */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>📅 Tarih & Saat</Text>
          <Text style={styles.infoValue}>
            {new Date(event.eventDate).toLocaleDateString('tr-TR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Text>
          <Text style={styles.infoValueSub}>
            🕐 {new Date(event.eventDate).toLocaleTimeString('tr-TR', {
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>

        {/* SANATÇI — tıklanabilir ✅ */}
        {event.artistName && (
          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => navigation.navigate('ArtistProfile', {
              artistId: event.artistId,
              artistName: event.artistName,
            })}
            activeOpacity={0.8}
          >
            <Text style={styles.sectionTitle}>🎤 Sanatçı</Text>
            <View style={styles.artistRow}>
              <Text style={styles.infoValue}>{event.artistName}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* MEKAN */}
        {event.venueName && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>📍 Mekan</Text>
            <Text style={styles.infoValue}>{event.venueName}</Text>
            {event.venueCity && event.venueCountry && (
              <Text style={styles.infoValueSub}>
                {event.venueCity}, {event.venueCountry}
              </Text>
            )}
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
        {/* BİLET BUTONU */}
        {event.ticketUrl && (
          <TouchableOpacity
            onPress={async () => {
              const supported = await Linking.canOpenURL(event.ticketUrl);

              if (supported) {
                await Linking.openURL(event.ticketUrl);
              } else {
                Alert.alert('Hata', 'Bu link açılamıyor');
              }
            }} style={styles.ticketButton}
          >
            <Text style={styles.ticketButtonText}>
              🎫 Bilet Al
            </Text>
          </TouchableOpacity>
        )}
        {/* POST AT BUTONU */}

        {verifying ? (
          <View style={styles.verifyingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.verifyingText}>Konumun doğrulanıyor...</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={handlePostAt} activeOpacity={0.85}>
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

function createStyles(colors) {
  return StyleSheet.create({
    heroImage: {
      width: '100%',
      height: 320,
    },

    heroOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 320,
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      paddingBottom: 24,
      paddingHorizontal: 24,
    },
    heroTopActions: {
      position: 'absolute',
      top: 56,
      left: 20,
    },

    genreBadge: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      marginTop: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },

    genreText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    container: { flex: 1, backgroundColor: colors.background },

    heroSection: {
      paddingTop: 64, paddingBottom: 40,
      paddingHorizontal: 24, alignItems: 'center',
    },
    backButton: { 
      backgroundColor: 'rgba(255,255,255,0.15)', 
      paddingHorizontal: 16, paddingVertical: 8, 
      borderRadius: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
    },
    backText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    heroEmoji: { fontSize: 64, marginBottom: 12 },
    heroTitle: {
      fontSize: 32, fontWeight: '900',
      color: '#fff', textAlign: 'left', marginBottom: 4,
      letterSpacing: 0.5,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    approvedBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
    },
    approvedText: { color: '#fff', fontWeight: '600', fontSize: 13 },

    content: { padding: 20, gap: 16 },

    // KATILIM
    attendanceRow: { flexDirection: 'row', gap: 12 },
    attendBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 8,
      paddingVertical: 16, borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    attendBtnActive: { backgroundColor: 'rgba(0,212,170,0.15)', borderColor: '#00D4AA' },
    attendBtnActiveYellow: { backgroundColor: 'rgba(245,166,35,0.15)', borderColor: '#F5A623' },
    attendBtnEmoji: { fontSize: 18 },
    attendBtnText: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
    attendBtnTextActive: { color: '#00D4AA' },
    attendBtnTextActiveYellow: { color: '#F5A623' },

    // INFO KARTLARI
    infoCard: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 20, padding: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    sectionTitle: {
      fontSize: 13, color: 'rgba(255,255,255,0.5)',
      marginBottom: 10, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 1.2,
    },
    description: { fontSize: 15, color: '#fff', lineHeight: 24 },
    infoValue: { fontSize: 17, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
    infoValueSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 },

    // SANATÇI SATIRI
    artistRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    chevron: { fontSize: 24, color: 'rgba(255,255,255,0.4)' },

    // KONUM DOĞRULAMA
    verifyInfoCard: {
      backgroundColor: 'rgba(0,212,170,0.08)',
      borderRadius: 20, padding: 18,
      flexDirection: 'row', alignItems: 'center', gap: 14,
      borderWidth: 1, borderColor: 'rgba(0,212,170,0.3)',
    },
    verifyInfoEmoji: { fontSize: 32 },
    verifyInfoText: { flex: 1 },
    verifyInfoTitle: { color: '#00D4AA', fontWeight: '800', fontSize: 15, marginBottom: 6 },
    verifyInfoSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20 },

    verifyingContainer: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: 20,
    },
    verifyingText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },

    actionButton: {
      padding: 18, borderRadius: 20,
      alignItems: 'center', marginTop: 12, marginBottom: 36,
      shadowColor: '#E94560', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    actionButtonText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
    
    ticketButton: {
      backgroundColor: '#E94560',
      padding: 18,
      borderRadius: 20,
      alignItems: 'center',
      marginTop: 12,
      shadowColor: '#E94560', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
    },

    ticketButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },

    imageLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    imageErrorOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    imageErrorText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
}
