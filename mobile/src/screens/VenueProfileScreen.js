import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Dimensions,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');
const DAY_SIZE = Math.floor((width - 32) / 7);

function StarRating({ value, onChange, size = 28 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1,2,3,4,5].map(star => (
        <TouchableOpacity key={star} onPress={() => onChange && onChange(star)} activeOpacity={0.7}>
          <Text style={{ fontSize: size, color: star <= value ? '#F5A623' : '#444' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function VenueProfileScreen({ route, navigation }) {
  const { venueId, venueName } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const MONTHS = t('venue_months').split(',');
  const DAYS = t('venue_days').split(',');

  const [venue, setVenue]       = useState(null);
  const [events, setEvents]     = useState([]);
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(true);

  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const [reviewModal, setReviewModal] = useState(false);
  const [myRating, setMyRating]       = useState(0);
  const [myComment, setMyComment]     = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [vRes, eRes, rRes] = await Promise.all([
        API.get(`/venues/${venueId}`),
        API.get(`/venues/${venueId}/events`),
        API.get(`/venues/${venueId}/reviews`),
      ]);
      setVenue(vRes.data);
      setEvents(eRes.data);
      setReviews(rRes.data);
      if (vRes.data.myRating) {
        setMyRating(vRes.data.myRating);
      }
    } catch {
      Alert.alert('Hata', 'Mekan bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  // Takvim için: hangi günde hangi etkinlik var
  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const d = new Date(e.eventDate);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(e);
      }
    });
    return map;
  }, [events, calYear, calMonth]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;   // Mon=0
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calYear, calMonth]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const handleSaveReview = async () => {
    if (myRating === 0) { Alert.alert(t('review_no_rating'), t('review_no_rating_sub')); return; }
    setSaving(true);
    try {
      await API.post(`/venues/${venueId}/reviews`, { rating: myRating, comment: myComment.trim() || null });
      setReviewModal(false);
      fetchAll();
    } catch {
      Alert.alert(t('error'), t('review_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReview = (reviewId) => {
    Alert.alert(t('postdetail_delete_title'), t('postdetail_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        try {
          await API.delete(`/venues/${venueId}/reviews/${reviewId}`);
          fetchAll();
        } catch { Alert.alert(t('error'), t('postdetail_del_error')); }
      }}
    ]);
  };

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <>
      {/* YORUM MODALI */}
      <Modal visible={reviewModal} transparent animationType="slide" onRequestClose={() => setReviewModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReviewModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrapper}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('venue_rate_title')}</Text>
            <Text style={[styles.modalVenueName, { color: colors.textSecondary }]}>{venue?.name}</Text>
            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <StarRating value={myRating} onChange={setMyRating} size={36} />
            </View>
            <TextInput
              style={[styles.commentInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={t('venue_comment_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={myComment}
              onChangeText={setMyComment}
              multiline
              maxLength={300}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setReviewModal(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
                onPress={handleSaveReview} disabled={saving}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{saving ? t('artsel_saving') : t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.headerWrap}>
          {venue?.imageUrl ? (
            <Image source={{ uri: venue.imageUrl }} style={styles.headerImage} />
          ) : (
            <LinearGradient colors={['#1A1A2E', '#7C3AED']} style={styles.headerImage} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.headerGradient} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.venueName}>{venue?.name}</Text>
            <Text style={styles.venueLocation}>📍 {[venue?.city, venue?.country].filter(Boolean).join(', ')}</Text>
            {venue?.address ? <Text style={styles.venueAddress}>{venue.address}</Text> : null}
          </View>
        </View>

        {/* STATS */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {venue?.avgRating > 0 ? venue.avgRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>⭐ Puan</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{venue?.reviewCount || 0}</Text>
            <Text style={styles.statLabel}>Yorum</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{venue?.totalEvents || 0}</Text>
            <Text style={styles.statLabel}>Etkinlik</Text>
          </View>
        </View>

        {/* TAKVİM */}
        <View style={styles.section}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
              <Text style={styles.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calTitle}>{MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
              <Text style={styles.calNavText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Gün başlıkları */}
          <View style={styles.calWeekRow}>
            {DAYS.map(d => (
              <Text key={d} style={[styles.calWeekDay, { width: DAY_SIZE }]}>{d}</Text>
            ))}
          </View>

          {/* Günler */}
          <View style={styles.calGrid}>
            {calendarDays.map((day, idx) => {
              const dayEvents = day ? (eventsByDay[day] || []) : [];
              const firstEvent = dayEvents[0];
              const isToday = day && calYear === now.getFullYear() && calMonth === now.getMonth() && day === now.getDate();

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.calCell, { width: DAY_SIZE, height: DAY_SIZE + 12 }]}
                  disabled={!firstEvent}
                  onPress={() => firstEvent && navigation.navigate('EventDetail', { event: firstEvent })}
                  activeOpacity={0.75}
                >
                  {firstEvent?.imageUrl ? (
                    <>
                      <Image source={{ uri: firstEvent.imageUrl }} style={styles.calArtistImg} />
                      <View style={styles.calDayOnImage}>
                        <Text style={styles.calDayOnImageText}>{day}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={[styles.calDayWrap, isToday && styles.calDayToday]}>
                      <Text style={[styles.calDay, { color: day ? colors.text : 'transparent' }, isToday && { color: '#fff' }]}>
                        {day || ''}
                      </Text>
                    </View>
                  )}
                  {dayEvents.length > 1 && (
                    <View style={styles.calMoreBadge}>
                      <Text style={styles.calMoreText}>+{dayEvents.length - 1}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {Object.keys(eventsByDay).length === 0 && (
            <Text style={[styles.noEventsText, { color: colors.textSecondary }]}>Bu ay etkinlik yok</Text>
          )}
        </View>

        {/* PUAN BUTONU */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setReviewModal(true)}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.rateBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.rateBtnText}>
                {venue?.myRating ? `${t('venue_rate_update')}  ★${venue.myRating}` : t('venue_rate_btn')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* YORUMLAR */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yorumlar ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('venue_no_reviews')}</Text>
          ) : (
            reviews.map(r => (
              <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    {r.profileImageUrl ? (
                      <Image source={{ uri: r.profileImageUrl }} style={styles.reviewAvatar} />
                    ) : (
                      <View style={[styles.reviewAvatar, styles.reviewAvatarPlaceholder, { backgroundColor: colors.border }]}>
                        <Text style={{ fontSize: 14 }}>👤</Text>
                      </View>
                    )}
                    <View>
                      <Text style={[styles.reviewUsername, { color: colors.text }]}>@{r.username}</Text>
                      <StarRating value={r.rating} size={14} />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
                      {new Date(r.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    </Text>
                    {r.userId === session.userId && (
                      <TouchableOpacity onPress={() => handleDeleteReview(r.id)}>
                        <Text style={{ color: '#E94560', fontSize: 12 }}>Sil</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {r.comment ? (
                  <Text style={[styles.reviewComment, { color: colors.text }]}>{r.comment}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // HEADER
    headerWrap: { height: 240, position: 'relative' },
    headerImage: { width: '100%', height: 240, resizeMode: 'cover' },
    headerGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 },
    backBtn: {
      position: 'absolute', top: 52, left: 16,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center',
    },
    backBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    headerInfo: { position: 'absolute', bottom: 16, left: 16, right: 16 },
    venueName: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4 },
    venueLocation: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
    venueAddress: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

    // STATS
    statsRow: {
      flexDirection: 'row', backgroundColor: colors.card,
      marginHorizontal: 16, marginTop: 12, borderRadius: 16,
      padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    statBox: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6 },
    statDivider: { width: 1, backgroundColor: colors.border },

    // SECTION
    section: { marginTop: 16, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },

    // TAKVİM
    calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    calNavBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    calNavText: { fontSize: 28, color: colors.primary, fontWeight: '300' },
    calTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    calWeekRow: { flexDirection: 'row', marginBottom: 4 },
    calWeekDay: { textAlign: 'center', fontSize: 11, color: colors.textSecondary, fontWeight: '700', paddingVertical: 4 },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: { justifyContent: 'center', alignItems: 'center', position: 'relative', marginBottom: 4 },
    calArtistImg: {
      width: DAY_SIZE - 6, height: DAY_SIZE - 6,
      borderRadius: (DAY_SIZE - 6) / 2,
      borderWidth: 2, borderColor: '#E94560',
    },
    calDayOnImage: {
      position: 'absolute', bottom: 2,
      backgroundColor: 'rgba(233,69,96,0.85)',
      borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1,
    },
    calDayOnImageText: { fontSize: 9, color: '#fff', fontWeight: '800' },
    calDayWrap: {
      width: DAY_SIZE - 8, height: DAY_SIZE - 8,
      borderRadius: (DAY_SIZE - 8) / 2,
      justifyContent: 'center', alignItems: 'center',
    },
    calDayToday: { backgroundColor: colors.primary },
    calDay: { fontSize: 13, fontWeight: '600' },
    calMoreBadge: {
      position: 'absolute', top: 2, right: 2,
      backgroundColor: '#7C3AED', borderRadius: 6,
      paddingHorizontal: 3, paddingVertical: 1,
    },
    calMoreText: { fontSize: 8, color: '#fff', fontWeight: '800' },
    noEventsText: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },

    // PUAN BUTONU
    rateBtn: { padding: 16, borderRadius: 16, alignItems: 'center' },
    rateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // YORUMLAR
    emptyText: { fontSize: 14, paddingVertical: 16 },
    reviewCard: {
      borderRadius: 14, padding: 14, marginBottom: 10,
      borderWidth: 1,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    reviewAvatar: { width: 36, height: 36, borderRadius: 18 },
    reviewAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    reviewUsername: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
    reviewDate: { fontSize: 11 },
    reviewComment: { fontSize: 14, lineHeight: 20 },

    // MODAL
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    modalWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
    modalVenueName: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
    commentInput: {
      borderWidth: 1, borderRadius: 12, padding: 12,
      fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
    },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontWeight: '700' },
  });
}
