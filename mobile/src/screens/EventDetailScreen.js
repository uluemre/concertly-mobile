import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
  Linking, Platform, Modal, Animated, FlatList, TextInput
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Calendar from 'expo-calendar';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getGenreGradient } from '../utils/gradients';
import { formatTimeAgo } from '../utils/time';
import ConfettiOverlay from '../components/ConfettiOverlay';

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
  const { session } = useAuth();
  const { t } = useLanguage();
  const { event } = route.params;
  const confettiRef = useRef(null);
  const scrollViewRef = useRef(null);
  const reviewsOffsetY = useRef(0);

  // Attendance button scale animations
  const goingScale      = useRef(new Animated.Value(1)).current;
  const interestedScale = useRef(new Animated.Value(1)).current;

  const bounceBtn = (anim) => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 0.9, useNativeDriver: true, tension: 300, friction: 5 }),
      Animated.spring(anim, { toValue: 1.06, useNativeDriver: true, tension: 300, friction: 5 }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 5 }),
    ]).start();
  };

  const [verifying, setVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
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
  const [useFallbackImage, setUseFallbackImage] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // ── Konser Arkadaşı ──
  const [buddies, setBuddies] = useState([]);
  const [isBuddy, setIsBuddy] = useState(false);
  const [buddyMessage, setBuddyMessage] = useState('');
  const [buddyLoading, setBuddyLoading] = useState(false);
  const [showBuddyInput, setShowBuddyInput] = useState(false);

  // ── Değerlendirme ──
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);

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

    API.get(`/events/${event.id}/verify`)
      .then(res => setIsVerified(res.data.verified ?? false))
      .catch(() => {});

    // Buddy durumu yükle
    API.get(`/events/${event.id}/buddies/me`)
      .then(res => {
        setIsBuddy(res.data.joined);
        setBuddyMessage(res.data.message || '');
      })
      .catch(() => {});
    API.get(`/events/${event.id}/buddies`)
      .then(res => setBuddies(res.data))
      .catch(() => {});

    // Değerlendirmeleri yükle
    setReviewsLoading(true);
    API.get(`/events/${event.id}/reviews`)
      .then(res => {
        setReviews(res.data);
        const mine = res.data.find(r => r.userId === session.userId);
        if (mine) { setMyRating(mine.rating); setReviewText(mine.comment || ''); }
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
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
  const isExpired = new Date(event.eventDate) < new Date();

  const addToCalendar = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('cal_perm_title'), t('cal_perm_msg'));
      return;
    }

    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = calendars.find(c => c.allowsModifications);
      if (!writable) {
        Alert.alert(t('error'), 'Düzenlenebilir takvim bulunamadı.');
        return;
      }

      const startDate = new Date(event.eventDate);
      const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

      await Calendar.createEventAsync(writable.id, {
        title: event.name,
        startDate,
        endDate,
        location: [event.venueName, event.venueCity].filter(Boolean).join(', '),
        notes: event.description || '',
        alarms: [{ relativeOffset: -60 }, { relativeOffset: -1440 }],
        url: event.ticketUrl || undefined,
      });

      Alert.alert(t('cal_added_title'), t('cal_added_msg', { name: event.name }));
    } catch (err) {
      Alert.alert(t('error'), 'Takvime eklenemedi.');
    }
  };

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
        Alert.alert(t('error'), t('detail_action_error'));
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
      Alert.alert(t('error'), t('detail_action_error'));
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
        Alert.alert(t('detail_location_perm_title'), t('detail_location_perm_msg'), [{ text: t('confirm') }]);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      const distance = getDistanceInMeters(latitude, longitude, event.venueLatitude, event.venueLongitude);

      const distanceFormatted =
        distance < 1000
          ? `${Math.round(distance)} metre`
          : `${(distance / 1000).toFixed(1)} km`;

      if (distance <= 200) {
        if (!isVerified) {
          try {
            await API.post(`/events/${event.id}/verify`);
            setIsVerified(true);
          } catch (err) {
            if (err.response?.status === 409) setIsVerified(true);
          }
        }
        confettiRef.current?.fire();
        Alert.alert(
          t('detail_verified_alert_title'),
          t('detail_verified_alert_msg', { distance: distanceFormatted }),
          [{ text: t('detail_verified_alert_btn'), onPress: () => navigation.navigate('CreatePost', { event, verified: true }) }]
        );
      } else {
        Alert.alert(
          t('detail_far_alert_title'),
          t('detail_far_alert_msg', { distance: distanceFormatted }),
          [{ text: t('confirm') }]
        );
      }
    } catch (err) {
      Alert.alert(t('error'), t('detail_location_error'));
      console.log(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleBuddy = async () => {
    setBuddyLoading(true);
    try {
      if (isBuddy) {
        await API.delete(`/events/${event.id}/buddies`);
        setIsBuddy(false);
        setBuddies(prev => prev.filter(b => b.userId !== session.userId));
      } else {
        await API.post(`/events/${event.id}/buddies`, { message: buddyMessage.trim() || null });
        setIsBuddy(true);
        setShowBuddyInput(false);
        const res = await API.get(`/events/${event.id}/buddies`);
        setBuddies(res.data);
      }
    } catch {
      Alert.alert(t('error'), t('detail_action_error'));
    } finally {
      setBuddyLoading(false);
    }
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const handleSubmitReview = async () => {
    if (!myRating) { Alert.alert(t('review_no_rating'), t('review_no_rating_sub')); return; }
    setReviewLoading(true);
    try {
      const res = await API.post(`/events/${event.id}/reviews`, {
        rating: myRating,
        comment: reviewText.trim() || null,
      });
      setReviews(prev => {
        const filtered = prev.filter(r => r.userId !== session.userId);
        return [res.data, ...filtered];
      });
      Alert.alert(t('review_saved_title'), t('review_saved_msg'));
    } catch {
      Alert.alert(t('error'), t('review_error'));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteReview = () => {
    Alert.alert(t('review_delete_title'), t('review_delete_msg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('review_delete'), style: 'destructive', onPress: async () => {
          try {
            await API.delete(`/events/${event.id}/reviews`);
            setReviews(prev => prev.filter(r => r.userId !== session.userId));
            setMyRating(0);
            setReviewText('');
          } catch {
            Alert.alert(t('error'), t('review_del_error'));
          }
        },
      },
    ]);
  };

  return (
    <>
    <ScrollView ref={scrollViewRef} style={styles.container}>
      {/* HERO */}
      {(event.imageUrl || event.artistImageUrl) && !imageError ? (
        <View>
          <Image
            source={{ uri: useFallbackImage ? event.artistImageUrl : (event.imageUrl || event.artistImageUrl) }}
            style={styles.heroImage}
            contentFit="cover"
            placeholder={require('../../assets/icon.png')}
            onError={() => {
              if (!useFallbackImage && event.artistImageUrl && event.artistImageUrl !== event.imageUrl) {
                setUseFallbackImage(true);
              } else {
                setImageError(true);
              }
              setImageLoading(false);
            }}
            onLoad={() => setImageLoading(false)}
            onLoadStart={() => setImageLoading(true)}
            cachePolicy="memory-disk"
            transition={300}
          />

          {imageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.heroOverlay}>
            <View style={styles.heroTopActions}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backText}>{t('back')}</Text>
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
              <Text style={styles.backText}>{t('back')}</Text>
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
          <Animated.View style={{ flex: 1, transform: [{ scale: goingScale }] }}>
          <TouchableOpacity
            style={[styles.attendBtn, attendance === 'GOING' && styles.attendBtnActive, isExpired && styles.attendBtnDisabled]}
            onPress={() => { bounceBtn(goingScale); handleAttend('GOING'); }}
            disabled={attendLoading || isExpired}
            activeOpacity={1}
          >
            <Text style={styles.attendBtnEmoji}>✅</Text>
            <View>
              <Text style={[styles.attendBtnText, attendance === 'GOING' && styles.attendBtnTextActive]}>
                {t('events_going')}
              </Text>
              {goingCount > 0 && (
                <Text style={[styles.attendBtnCount, attendance === 'GOING' && styles.attendBtnTextActive]}>
                  {t('detail_people', { count: goingCount })}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ flex: 1, transform: [{ scale: interestedScale }] }}>
          <TouchableOpacity
            style={[styles.attendBtn, attendance === 'INTERESTED' && styles.attendBtnActiveYellow, isExpired && styles.attendBtnDisabled]}
            onPress={() => { bounceBtn(interestedScale); handleAttend('INTERESTED'); }}
            disabled={attendLoading || isExpired}
            activeOpacity={1}
          >
            <Text style={styles.attendBtnEmoji}>⭐</Text>
            <View>
              <Text style={[styles.attendBtnText, attendance === 'INTERESTED' && styles.attendBtnTextActiveYellow]}>
                {t('events_interested')}
              </Text>
              {interestedCount > 0 && (
                <Text style={[styles.attendBtnCount, attendance === 'INTERESTED' && styles.attendBtnTextActiveYellow]}>
                  {t('detail_people', { count: interestedCount })}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          </Animated.View>
        </View>

        {/* KONSER ARKADAŞI */}
        {!isExpired && (
          <View style={[styles.buddyCard, { backgroundColor: colors.card, borderColor: isBuddy ? colors.primary : colors.border }]}>
            <View style={styles.buddyCardHeader}>
              <View>
                <Text style={[styles.buddyTitle, { color: colors.text }]}>{t('detail_buddy_title')}</Text>
                <Text style={[styles.buddySub, { color: colors.textSecondary }]}>
                  {buddies.length > 0
                    ? t('detail_buddy_sub_count', { count: buddies.length })
                    : t('detail_buddy_sub_empty')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => isBuddy ? handleToggleBuddy() : setShowBuddyInput(v => !v)}
                disabled={buddyLoading}
                style={[styles.buddyToggleBtn, { backgroundColor: isBuddy ? colors.primary : colors.cardAlt, borderColor: colors.border }]}
                activeOpacity={0.8}
              >
                {buddyLoading
                  ? <ActivityIndicator size="small" color={isBuddy ? '#fff' : colors.primary} />
                  : <Text style={[styles.buddyToggleText, { color: isBuddy ? '#fff' : colors.primary }]}>
                      {isBuddy ? t('detail_buddy_active') : t('detail_buddy_join')}
                    </Text>
                }
              </TouchableOpacity>
            </View>

            {/* Mesaj girişi */}
            {showBuddyInput && !isBuddy && (
              <View style={styles.buddyInputWrap}>
                <TextInput
                  style={[styles.buddyInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder={t('detail_buddy_msg_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={buddyMessage}
                  onChangeText={setBuddyMessage}
                  maxLength={200}
                />
                <TouchableOpacity
                  onPress={handleToggleBuddy}
                  disabled={buddyLoading}
                  style={[styles.buddySendBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buddySendText}>{t('detail_buddy_start')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Arkadaş arayanlar listesi */}
            {buddies.length > 0 && (
              <View style={styles.buddyList}>
                {buddies.map((b, i) => (
                  <TouchableOpacity
                    key={b.userId}
                    style={[styles.buddyRow, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 1 : 0 }]}
                    onPress={() => b.userId !== session.userId && navigation.navigate('UserProfile', { userId: b.userId })}
                    activeOpacity={b.userId === session.userId ? 1 : 0.7}
                  >
                    <View style={[styles.buddyAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.buddyAvatarText}>{b.username?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.buddyInfo}>
                      <Text style={[styles.buddyUsername, { color: colors.text }]}>
                        @{b.username}
                        {b.userId === session.userId && <Text style={{ color: colors.primary }}> {t('detail_you')}</Text>}
                      </Text>
                      {b.city ? <Text style={[styles.buddyCity, { color: colors.textSecondary }]}>📍 {b.city}</Text> : null}
                      {b.message ? <Text style={[styles.buddyMessage, { color: colors.textSecondary }]}>"{b.message}"</Text> : null}
                    </View>
                    {b.userId !== session.userId && (
                      <Text style={[styles.buddyChevron, { color: colors.textSecondary }]}>›</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

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
                ? ` ${t('detail_friend_more', { count: friendsGoing.length - 2 })}`
                : t('detail_friend_going')}
            </Text>
          </TouchableOpacity>
        )}

        {/* ETKİNLİK HAKKINDA */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t('events_about')}</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        {/* TARİH & SAAT */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t('detail_date_time')}</Text>
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
            <Text style={styles.sectionTitle}>{t('events_artist')}</Text>
            <View style={styles.artistRow}>
              <Text style={styles.infoValue}>{event.artistName}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* MEKAN + INLINE HARİTA */}
        {event.venueName && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t('events_venue')}</Text>
            <TouchableOpacity
              onPress={() => event.venueId && navigation.navigate('VenueProfile', { venueId: event.venueId, venueName: event.venueName })}
              activeOpacity={event.venueId ? 0.7 : 1}
            >
              <Text style={[styles.infoValue, event.venueId && { color: '#E94560', textDecorationLine: 'underline' }]}>
                {event.venueName}
              </Text>
            </TouchableOpacity>
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
                    <Text style={styles.mapOverlayText}>{t('detail_open_map')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* KONUM DOĞRULAMA BİLGİSİ */}
        {hasCoordinates && !isExpired && (
          <View style={styles.verifyInfoCard}>
            <Text style={styles.verifyInfoEmoji}>📍</Text>
            <View style={styles.verifyInfoText}>
              <Text style={styles.verifyInfoTitle}>{t('events_verify_active')}</Text>
              <Text style={styles.verifyInfoSub}>{t('events_verify_sub')}</Text>
            </View>
          </View>
        )}

        {isExpired && (
          <View style={[styles.verifyInfoCard, { backgroundColor: colors.card }]}>
            <Text style={styles.verifyInfoEmoji}>🗓️</Text>
            <View style={styles.verifyInfoText}>
              <Text style={[styles.verifyInfoTitle, { color: colors.textSecondary }]}>{t('events_expired')}</Text>
              <Text style={styles.verifyInfoSub}>{t('events_expired_sub')}</Text>
            </View>
          </View>
        )}

        {/* BİLET BUTONU */}
        {event.ticketUrl && !isExpired && (
          <TouchableOpacity
            onPress={async () => {
              const supported = await Linking.canOpenURL(event.ticketUrl);
              if (supported) {
                await Linking.openURL(event.ticketUrl);
              } else {
                Alert.alert(t('error'), 'Bu link açılamıyor');
              }
            }}
            style={styles.ticketButton}
          >
            <Text style={styles.ticketButtonText}>{t('events_ticket')}</Text>
          </TouchableOpacity>
        )}

        {/* DOĞRULAMA BADGE */}
        {isVerified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedBadgeText}>{t('events_verified_badge')}</Text>
            <Text style={styles.verifiedBadgeSub}>{t('detail_verified_sub')}</Text>
          </View>
        )}

        {/* TAKVİME EKLE */}
        {!isExpired && (
          <TouchableOpacity onPress={addToCalendar} style={styles.calendarButton} activeOpacity={0.85}>
            <Text style={styles.calendarButtonText}>{t('events_add_calendar')}</Text>
          </TouchableOpacity>
        )}

        {/* SETLİST TAHMİN LİGİ */}
        {event.artistName && (
          <TouchableOpacity
            onPress={() => navigation.navigate('SetlistPrediction', { eventId: event.id })}
            style={styles.calendarButton}
            activeOpacity={0.85}
          >
            <Text style={styles.calendarButtonText}>
              {isExpired ? t('detail_setlist_results_btn') : t('detail_setlist_btn')}
            </Text>
          </TouchableOpacity>
        )}

        {/* YORUM PILL — geçmiş etkinliklerde scroll kısayolu */}
        {isExpired && (
          <TouchableOpacity
            style={styles.reviewPill}
            onPress={() => scrollViewRef.current?.scrollTo({ y: reviewsOffsetY.current, animated: true })}
            activeOpacity={0.8}
          >
            <Text style={styles.reviewPillText}>
              ⭐ {reviews.length > 0 ? `${reviews.length} yorum · ${avgRating} puan` : 'Değerlendir'}
            </Text>
            <Text style={styles.reviewPillChevron}>↓</Text>
          </TouchableOpacity>
        )}

        {/* POST AT BUTONU */}
        {!isExpired && (
          verifying ? (
            <View style={styles.verifyingContainer}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.verifyingText}>{t('detail_verifying')}</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={handlePostAt} activeOpacity={0.85}>
              <LinearGradient
                colors={isVerified ? ['#00D4AA', '#00A896'] : ['#F5A623', '#E94560']}
                style={styles.actionButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.actionButtonText}>
                  {isVerified ? t('events_post_verified') : t('events_post')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )
        )}

        {/* ── DEĞERLENDİRMELER (sadece geçmiş etkinlikler) ── */}
        {isExpired && (
          <View
            style={styles.reviewSection}
            onLayout={e => { reviewsOffsetY.current = e.nativeEvent.layout.y; }}
          >
            {/* Özet */}
            <View style={styles.reviewHeader}>
              <Text style={styles.sectionTitle}>{t('review_title')}</Text>
              {avgRating && (
                <View style={styles.avgBadge}>
                  <Text style={styles.avgRatingText}>{avgRating}</Text>
                  <Text style={styles.avgRatingStars}>{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</Text>
                  <Text style={styles.avgCount}>({reviews.length})</Text>
                </View>
              )}
            </View>

            {/* Puan ver */}
            <View style={[styles.myReviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.myReviewTitle}>
                {reviews.find(r => r.userId === session.userId) ? t('review_my_update') : t('review_my_title')}
              </Text>
              {event.artistId && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('ArtistProfile', { artistId: event.artistId, artistName: event.artistName })}
                  activeOpacity={0.7}
                  style={styles.artistHintBtn}
                >
                  <Text style={[styles.artistHintText, { color: colors.primary }]}>
                    🎤 {event.artistName} profilini değerlendirmek için buraya dokun
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setMyRating(star)} activeOpacity={0.7}>
                    <Text style={[styles.star, myRating >= star && styles.starActive]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.reviewInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder={t('review_placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                maxLength={300}
              />
              <View style={styles.reviewActions}>
                {reviews.find(r => r.userId === session.userId) && (
                  <TouchableOpacity onPress={handleDeleteReview} style={styles.deleteReviewBtn}>
                    <Text style={styles.deleteReviewText}>{t('review_delete')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSubmitReview}
                  disabled={reviewLoading || !myRating}
                  style={[styles.submitReviewBtn, { backgroundColor: myRating ? colors.primary : colors.border }]}
                >
                  {reviewLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.submitReviewText}>{t('review_submit')}</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {/* Değerlendirme listesi */}
            {reviewsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            ) : (
              reviews.map(r => (
                <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.reviewCardHeader}>
                    <View style={styles.reviewCardLeft}>
                      <View style={[styles.reviewAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.reviewAvatarText}>{r.username?.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={[styles.reviewUsername, { color: colors.text }]}>@{r.username}</Text>
                        <Text style={[styles.reviewTime, { color: colors.textSecondary }]}>{formatTimeAgo(r.createdAt)}</Text>
                      </View>
                    </View>
                    <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                  </View>
                  {r.comment && (
                    <Text style={[styles.reviewComment, { color: colors.text }]}>{r.comment}</Text>
                  )}
                </View>
              ))
            )}
            {!reviewsLoading && reviews.length === 0 && (
              <Text style={[styles.noReviews, { color: colors.textSecondary }]}>{t('review_empty')}</Text>
            )}
          </View>
        )}

      </View>
    </ScrollView>

    {/* ARKADAŞLAR MODAL */}
    <Modal visible={friendsModalVisible} transparent animationType="none" onRequestClose={closeFriendsModal}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeFriendsModal} />
      <Animated.View style={[styles.friendsSheet, { transform: [{ translateY: friendsSlideAnim }] }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{t('detail_friends_title')}</Text>
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
    <ConfettiOverlay ref={confettiRef} />
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
    attendanceRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
    attendBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 8,
      paddingVertical: 16, borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
    },
    attendBtnActive: { backgroundColor: colors.accent + '26', borderColor: colors.accent },
    attendBtnActiveYellow: { backgroundColor: colors.secondary + '26', borderColor: colors.secondary },
    attendBtnDisabled: { opacity: 0.4 },
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
    // ── KONSER ARKADAŞI STİLLERİ ──
    buddyCard: {
      borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 12,
    },
    buddyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    buddyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
    buddySub: { fontSize: 12 },
    buddyToggleBtn: {
      paddingHorizontal: 14, paddingVertical: 9,
      borderRadius: 12, borderWidth: 1, minWidth: 80, alignItems: 'center',
    },
    buddyToggleText: { fontSize: 13, fontWeight: '800' },
    buddyInputWrap: { marginTop: 14, gap: 10 },
    buddyInput: {
      borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14,
    },
    buddySendBtn: { padding: 13, borderRadius: 12, alignItems: 'center' },
    buddySendText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    buddyList: { marginTop: 14, gap: 0 },
    buddyRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, borderTopWidth: 1,
    },
    buddyAvatar: {
      width: 36, height: 36, borderRadius: 18,
      justifyContent: 'center', alignItems: 'center',
    },
    buddyAvatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    buddyInfo: { flex: 1 },
    buddyUsername: { fontSize: 13, fontWeight: '800' },
    buddyCity: { fontSize: 11, marginTop: 1 },
    buddyMessage: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
    buddyChevron: { fontSize: 22, fontWeight: '300' },

    // ── DEĞERLENDİRME STİLLERİ ──
    reviewSection: { marginTop: 8, paddingBottom: 8 },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    avgBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    avgRatingText: { fontSize: 18, fontWeight: '900', color: colors.text },
    avgRatingStars: { fontSize: 13, color: '#F5A623' },
    avgCount: { fontSize: 12, color: colors.textSecondary },
    myReviewCard: {
      borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16,
    },
    myReviewTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
    artistHintBtn: { marginBottom: 12 },
    artistHintText: { fontSize: 12, fontWeight: '600' },
    starsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    star: { fontSize: 32, color: colors.border },
    starActive: { color: '#F5A623' },
    reviewInput: {
      borderWidth: 1, borderRadius: 12, padding: 12,
      fontSize: 14, minHeight: 72, textAlignVertical: 'top', marginBottom: 12,
    },
    reviewActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, alignItems: 'center' },
    deleteReviewBtn: { paddingHorizontal: 14, paddingVertical: 10 },
    deleteReviewText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    submitReviewBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    submitReviewText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
    reviewCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    reviewCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    reviewAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    reviewAvatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    reviewUsername: { fontSize: 13, fontWeight: '800' },
    reviewTime: { fontSize: 11, marginTop: 1 },
    reviewStars: { fontSize: 14, color: '#F5A623' },
    reviewComment: { fontSize: 14, lineHeight: 20 },
    noReviews: { textAlign: 'center', paddingVertical: 24, fontSize: 13 },

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
    verifiedBadge: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(0,212,170,0.12)',
      borderWidth: 1, borderColor: 'rgba(0,212,170,0.35)',
      borderRadius: 14, padding: 14, marginBottom: 12, gap: 10,
    },
    verifiedBadgeText: { color: '#00D4AA', fontWeight: '800', fontSize: 15 },
    verifiedBadgeSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

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
    calendarButton: {
      backgroundColor: colors.card, padding: 16, borderRadius: 20,
      alignItems: 'center', marginTop: 12,
      borderWidth: 1.5, borderColor: colors.border,
    },
    calendarButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },

    reviewPill: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: '#F5A62322', borderWidth: 1.5, borderColor: '#F5A62366',
      borderRadius: 20, paddingHorizontal: 18, paddingVertical: 13,
      marginTop: 12,
    },
    reviewPillText: { color: '#F5A623', fontSize: 15, fontWeight: '800' },
    reviewPillChevron: { color: '#F5A623', fontSize: 18, fontWeight: '700' },

    imageLoadingOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center',
    },
  });
}