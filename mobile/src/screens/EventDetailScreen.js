import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
  Linking, Platform, Modal, Animated, FlatList
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import API from '../services/api';
import { useTheme } from '../theme';

const GENRE_GRADIENTS = {
  'Rock':       ['#E94560', '#7C1AED'],
  'Pop':        ['#FF6B9D', '#C44569'],
  'Rap':        ['#2C3E50', '#F39C12'],
  'Elektronik': ['#00D4AA', '#0066CC'],
  'Jazz':       ['#F5A623', '#8B4513'],
  'Klasik':     ['#4A0E8F', '#1a237e'],
  'Indie':      ['#00BCD4', '#2E7D32'],
  'R&B':        ['#9C27B0', '#E91E63'],
  'Folk':       ['#8BC34A', '#5D4037'],
  'Reggae':     ['#43A047', '#FDD835'],
  'Arabesk':    ['#8B0000', '#DAA520'],
};

function getGenreGradient(genre) {
  if (!genre) return ['#E94560', '#7C3AED'];
  const key = Object.keys(GENRE_GRADIENTS).find(k =>
    genre.toLowerCase().includes(k.toLowerCase())
  );
  return GENRE_GRADIENTS[key] || ['#E94560', '#7C3AED'];
}

function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

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

// Haritaya tıklanınca Google Maps / Apple Maps aç
function openMapsApp(latitude, longitude, venueName) {
  const label = encodeURIComponent(venueName || 'Mekan');
  const url = Platform.select({
    ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
  });

  Linking.canOpenURL(url).then(supported => {
    if (supported) {
      Linking.openURL(url);
    } else {
      // Fallback: Google Maps web
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      );
    }
  });
}

export default function EventDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { event } = route.params;

  const [verifying, setVerifying] = useState(false);
  const [attendLoading, setAttendLoading] = useState(false);
  const [attendance, setAttendance] = useState(null);
  const [goingCount, setGoingCount] = useState(0);
  const [interestedCount, setInterestedCount] = useState(0);
  const [friendsGoing, setFriendsGoing] = useState([]);
  const [friendsModalVisible, setFriendsModalVisible] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const friendsSlideAnim = useRef(new Animated.Value(400)).current;
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    API.get(`/events/${event.id}/attendance`)
      .then(res => {
        setAttendance(res.data.status ?? null);
        setGoingCount(res.data.goingCount ?? 0);
        setInterestedCount(res.data.interestedCount ?? 0);
      })
      .catch(() => {});

    API.get(`/events/${event.id}/attendance/friends`)
      .then(res => setFriendsGoing(res.data ?? []))
      .catch(() => {});

    API.get(`/events/${event.id}/bookmark`)
      .then(res => setBookmarked(res.data.bookmarked ?? false))
      .catch(() => {});
  }, [event.id]);

  const handleBookmark = async () => {
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const res = await API.post(`/events/${event.id}/bookmark`);
      setBookmarked(res.data.bookmarked);
    } catch {
      setBookmarked(prev);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const hasCoordinates =
    event.venueLatitude != null && event.venueLongitude != null;

  const openFriendsModal = () => {
    setFriendsModalVisible(true);
    Animated.spring(friendsSlideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeFriendsModal = () => {
    Animated.timing(friendsSlideAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start(
      () => setFriendsModalVisible(false)
    );
  };

  // ── Katılım ──────────────────────────────────────────────────────────────
  const handleAttend = async (status) => {
    if (attendLoading) return;
    setAttendLoading(true);

    if (attendance === status) {
      try {
        await API.delete(`/events/${event.id}/attendance`);
        setAttendance(null);
        if (status === 'GOING') setGoingCount(c => Math.max(0, c - 1));
        else setInterestedCount(c => Math.max(0, c - 1));
      } catch (err) {
        Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
        console.log(err.message);
      } finally {
        setAttendLoading(false);
      }
      return;
    }

    try {
      const res = await API.post(`/events/${event.id}/attendance?status=${status}`);
      setAttendance(status);
      setGoingCount(res.data.goingCount ?? 0);
      setInterestedCount(res.data.interestedCount ?? 0);
    } catch (err) {
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
      console.log(err.message);
    } finally {
      setAttendLoading(false);
    }
  };

  // ── Konum doğrula & post at ───────────────────────────────────────────────
  const handlePostAt = async () => {
    if (!hasCoordinates) {
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
    <>
    <ScrollView style={styles.container}>
      {/* HERO */}
      {event.imageUrl && !imageError ? (
        <View>
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
            placeholder={require('../../assets/icon.png')}
            onError={() => { setImageError(true); setImageLoading(false); }}
            onLoad={() => setImageLoading(false)}
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
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backText}>← Geri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bookmarkButton} onPress={handleBookmark} activeOpacity={0.8}>
                <Text style={styles.bookmarkIcon}>{bookmarked ? '🔖' : '🏷️'}</Text>
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
        <LinearGradient
          colors={getGenreGradient(event.genre)}
          style={styles.heroSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroTopActions}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Geri</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bookmarkButton} onPress={handleBookmark} activeOpacity={0.8}>
              <Text style={styles.bookmarkIcon}>{bookmarked ? '🔖' : '🏷️'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroPlaceholderInitials}>
            {getInitials(event.artistName || event.name)}
          </Text>
          <Text style={styles.heroTitle}>{event.name}</Text>
          {event.genre && (
            <View style={styles.genreBadge}>
              <Text style={styles.genreText}>🎵 {event.genre}</Text>
            </View>
          )}
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
            <View>
              <Text style={[styles.attendBtnText, attendance === 'GOING' && styles.attendBtnTextActive]}>
                Gidiyorum
              </Text>
              {goingCount > 0 && (
                <Text style={[styles.attendBtnCount, attendance === 'GOING' && styles.attendBtnTextActive]}>
                  {goingCount} kişi
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attendBtn, attendance === 'INTERESTED' && styles.attendBtnActiveYellow]}
            onPress={() => handleAttend('INTERESTED')}
            disabled={attendLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.attendBtnEmoji}>⭐</Text>
            <View>
              <Text style={[styles.attendBtnText, attendance === 'INTERESTED' && styles.attendBtnTextActiveYellow]}>
                İlgileniyorum
              </Text>
              {interestedCount > 0 && (
                <Text style={[styles.attendBtnCount, attendance === 'INTERESTED' && styles.attendBtnTextActiveYellow]}>
                  {interestedCount} kişi
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* ARKADAŞLAR GİDİYOR */}
        {friendsGoing.length > 0 && (
          <TouchableOpacity
            style={styles.friendsCard}
            onPress={openFriendsModal}
            activeOpacity={0.8}
          >
            <View style={styles.friendsAvatarRow}>
              {friendsGoing.slice(0, 3).map((f, i) => (
                <View key={f.userId} style={[styles.friendAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}>
                  {f.profileImageUrl ? (
                    <Image source={{ uri: f.profileImageUrl }} style={styles.friendAvatarImg} contentFit="cover" />
                  ) : (
                    <View style={styles.friendAvatarPlaceholder}>
                      <Text style={styles.friendAvatarInitial}>{f.username?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <Text style={styles.friendsText}>
              <Text style={styles.friendsName}>
                {friendsGoing.slice(0, 2).map(f => f.username).join(', ')}
              </Text>
              {friendsGoing.length > 2
                ? ` ve ${friendsGoing.length - 2} kişi daha gidiyor`
                : ' gidiyor'}
            </Text>
          </TouchableOpacity>
        )}

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

        {/* SANATÇI */}
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

        {/* MEKAN + INLINE HARİTA */}
        {event.venueName && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>📍 Mekan</Text>
            <Text style={styles.infoValue}>{event.venueName}</Text>
            {event.venueCity && event.venueCountry && (
              <Text style={styles.infoValueSub}>
                {event.venueCity}, {event.venueCountry}
              </Text>
            )}
            {event.venueAddress && (
              <Text style={styles.venueAddress}>{event.venueAddress}</Text>
            )}

            {/* ── INLINE HARİTA ── */}
            {hasCoordinates && (
              <TouchableOpacity
                style={styles.mapWrapper}
                onPress={() => openMapsApp(event.venueLatitude, event.venueLongitude, event.venueName)}
                activeOpacity={0.9}
              >
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: event.venueLatitude,
                    longitude: event.venueLongitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  userInterfaceStyle="dark"
                  pointerEvents="none"
                >
                  <Marker
                    coordinate={{
                      latitude: event.venueLatitude,
                      longitude: event.venueLongitude,
                    }}
                    title={event.venueName}
                  />
                </MapView>

                {/* Harita üstü overlay — tıklanabilirlik ipucu */}
                <View style={styles.mapOverlay}>
                  <View style={styles.mapOverlayBadge}>
                    <Text style={styles.mapOverlayText}>🗺️ Haritada Aç</Text>
                  </View>
                </View>
              </TouchableOpacity>
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
            }}
            style={styles.ticketButton}
          >
            <Text style={styles.ticketButtonText}>🎫 Bilet Al</Text>
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

    {/* ARKADAŞLAR MODAL */}
    <Modal visible={friendsModalVisible} transparent animationType="none" onRequestClose={closeFriendsModal}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeFriendsModal} />
      <Animated.View style={[styles.friendsSheet, { transform: [{ translateY: friendsSlideAnim }] }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Gidecekler</Text>
        <FlatList
          data={friendsGoing}
          keyExtractor={item => String(item.userId)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.friendRow}
              onPress={() => { closeFriendsModal(); setTimeout(() => navigation.navigate('UserProfile', { userId: item.userId }), 300); }}
              activeOpacity={0.7}
            >
              <View style={styles.friendRowAvatar}>
                {item.profileImageUrl ? (
                  <Image source={{ uri: item.profileImageUrl }} style={styles.friendAvatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.friendAvatarPlaceholder}>
                    <Text style={styles.friendAvatarInitial}>{item.username?.[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.friendRowUsername}>{item.username}</Text>
              <Text style={styles.friendRowChevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>
    </Modal>
    </>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    heroImage: { width: '100%', height: 320 },
    heroOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 320,
      justifyContent: 'flex-end', alignItems: 'flex-start',
      paddingBottom: 24, paddingHorizontal: 24,
    },
    heroTopActions: {
      position: 'absolute', top: 56, left: 20, right: 20,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    bookmarkButton: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      padding: 10, borderRadius: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    bookmarkIcon: { fontSize: 18 },
    genreBadge: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginTop: 10,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    genreText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
    container: { flex: 1, backgroundColor: colors.background },
    heroSection: {
      paddingTop: 52, paddingBottom: 32,
      paddingHorizontal: 24, alignItems: 'flex-start', minHeight: 260,
    },
    backButton: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    backText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    heroEmoji: { fontSize: 64, marginBottom: 12 },
    heroPlaceholderInitials: {
      position: 'absolute', right: 20, bottom: 60,
      fontSize: 120, fontWeight: '900',
      color: 'rgba(255,255,255,0.15)', letterSpacing: -4,
    },
    heroTitle: {
      fontSize: 32, fontWeight: '900', color: '#fff',
      textAlign: 'left', marginBottom: 4, letterSpacing: 0.5,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
    },

    content: { padding: 20, gap: 16 },

    // KATILIM
    attendanceRow: { flexDirection: 'row', gap: 12 },
    attendBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 8,
      paddingVertical: 16, borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
    },
    attendBtnActive: { backgroundColor: colors.accent + '26', borderColor: colors.accent },
    attendBtnActiveYellow: { backgroundColor: colors.secondary + '26', borderColor: colors.secondary },
    attendBtnEmoji: { fontSize: 18 },
    attendBtnText: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
    attendBtnCount: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
    attendBtnTextActive: { color: colors.accent },
    attendBtnTextActiveYellow: { color: colors.secondary },

    // ARKADAŞLAR MODAL
    modalOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    friendsSheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, paddingBottom: 40,
      maxHeight: '60%',
    },
    sheetHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 17, fontWeight: '800', color: colors.text,
      marginBottom: 16,
    },
    friendRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    friendRowAvatar: {
      width: 44, height: 44, borderRadius: 22,
      overflow: 'hidden', marginRight: 12,
    },
    friendRowUsername: {
      flex: 1, fontSize: 15, fontWeight: '700', color: colors.text,
    },
    friendRowChevron: {
      fontSize: 22, color: colors.textSecondary,
    },

    // ARKADAŞLAR KART
    friendsCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.card,
      borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    friendsAvatarRow: { flexDirection: 'row', alignItems: 'center' },
    friendAvatar: {
      width: 32, height: 32, borderRadius: 16,
      borderWidth: 2, borderColor: colors.card,
      overflow: 'hidden',
    },
    friendAvatarImg: { width: '100%', height: '100%' },
    friendAvatarPlaceholder: {
      width: '100%', height: '100%',
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    friendAvatarInitial: { color: '#fff', fontSize: 13, fontWeight: '800' },
    friendsText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    friendsName: { color: colors.text, fontWeight: '700' },

    // INFO KARTLARI
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 14, color: colors.textSecondary,
      marginBottom: 10, fontWeight: '700',
    },
    description: { fontSize: 15, color: colors.text, lineHeight: 24 },
    infoValue: { fontSize: 17, color: colors.text, fontWeight: '700', letterSpacing: 0.3 },
    infoValueSub: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },
    venueAddress: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

    // SANATÇI SATIRI
    artistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chevron: { fontSize: 24, color: colors.textSecondary },

    // ── INLINE HARİTA ──
    mapWrapper: {
      marginTop: 16,
      borderRadius: 14,
      overflow: 'hidden',
      height: 180,
      position: 'relative',
      borderWidth: 1,
      borderColor: colors.border,
    },
    map: {
      width: '100%',
      height: '100%',
    },
    mapOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      padding: 10,
    },
    mapOverlayBadge: {
      backgroundColor: 'rgba(0,0,0,0.65)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    mapOverlayText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },

    // KONUM DOĞRULAMA
    verifyInfoCard: {
      backgroundColor: colors.accent + '14',
      borderRadius: 20, padding: 18,
      flexDirection: 'row', alignItems: 'center', gap: 14,
      borderWidth: 1, borderColor: colors.accent + '4D',
    },
    verifyInfoEmoji: { fontSize: 32 },
    verifyInfoText: { flex: 1 },
    verifyInfoTitle: { color: colors.accent, fontWeight: '800', fontSize: 15, marginBottom: 6 },
    verifyInfoSub: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },

    verifyingContainer: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: 20,
    },
    verifyingText: { color: colors.textSecondary, fontSize: 15 },

    actionButton: {
      padding: 16, borderRadius: 16, alignItems: 'center',
      marginTop: 12, marginBottom: 36,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    actionButtonText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },

    ticketButton: {
      backgroundColor: colors.primary, padding: 18, borderRadius: 20,
      alignItems: 'center', marginTop: 12,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
    },
    ticketButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    imageLoadingOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center',
    },
    imageErrorOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center', alignItems: 'center',
    },
    imageErrorText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  });
}