// "Konsere Hazırlan": gideceğin konser için tek ekran — canlı geri sayım,
// konser saatindeki hava + öneri, yol tarifi, gelen arkadaşlar, sanatçının
// en sevilen şarkılarından ısınma listesi ve havaya göre değişen hazırlık listesi.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Linking, Platform, ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import API from '../services/api';
import { useTheme } from '../theme';
import { hapticSelection } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';
import { stopPlayer } from '../utils/audio';
import { parseEventDate } from '../utils/time';
import { useCountdown, weatherLook, weatherAdviceKey, prepChecklist } from '../utils/concertDay';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';

const checklistKey = (eventId) => `concertPrep:${eventId}`;

export default function ConcertPrepScreen({ navigation, route }) {
  const { eventId } = route.params ?? {};
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState(null);
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    let alive = true;
    API.get(`/concert-day/events/${eventId}`)
      .then(res => { if (alive) { setData(res.data); setReceivedAt(Date.now()); } })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    AsyncStorage.getItem(checklistKey(eventId))
      .then(v => { if (alive && v) setChecked(JSON.parse(v)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [eventId]);

  const toggle = (id) => {
    hapticSelection();
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      AsyncStorage.setItem(checklistKey(eventId), JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (failed || !data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="ticket-outline" size={48} color={colors.textSecondary} style={styles.emptyEmoji} />
        <Text style={styles.emptyText}>{t('cday_load_error')}</Text>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.emptyBtn} accessibilityRole="button">
          <Text style={styles.emptyBtnText}>{t('back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = prepChecklist(data.weather);
  const done = items.filter(i => checked[i.id]).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Hero data={data} receivedAt={receivedAt} t={t} lang={lang} styles={styles} navigation={navigation} />

        <View style={styles.body}>
          <WeatherCard weather={data.weather} t={t} styles={styles} colors={colors} />

          <Directions data={data} t={t} styles={styles} colors={colors} />

          {data.friendsGoing?.length > 0 && (
            <Section title={t('cday_friends_title', { count: data.friendsGoing.length })} styles={styles}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {data.friendsGoing.map(f => (
                  <TouchableOpacity
                    key={f.userId}
                    style={styles.friend}
                    onPress={() => navigation.navigate('UserProfile', { userId: f.userId })}
                    accessibilityRole="button"
                    accessibilityLabel={`@${f.username}`}
                  >
                    {f.profileImageUrl
                      ? <Image source={{ uri: f.profileImageUrl }} style={styles.friendAvatar} />
                      : (
                        <View style={[styles.friendAvatar, styles.friendFallback]}>
                          <Text style={styles.friendLetter}>{(f.username || '?')[0].toUpperCase()}</Text>
                        </View>
                      )}
                    <Text style={styles.friendName} numberOfLines={1}>@{f.username}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}

          <Warmup tracks={data.warmup || []} artistName={data.artistName} t={t} styles={styles} colors={colors} />

          <Section
            title={t('cday_checklist_title')}
            right={<Text style={styles.progressText}>{done}/{items.length}</Text>}
            styles={styles}
          >
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(done / items.length) * 100}%` }]} />
            </View>
            {items.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.checkRow}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!checked[item.id] }}
                accessibilityLabel={t(item.key)}
              >
                <View style={[styles.checkBox, checked[item.id] && styles.checkBoxOn]}>
                  {checked[item.id] && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Ionicons name={item.icon} size={18} color={colors.textSecondary} />
                <Text style={[styles.checkText, checked[item.id] && styles.checkTextDone]}>{t(item.key)}</Text>
                {item.weather && <Text style={styles.checkTag}>{t('cday_weather_tag')}</Text>}
              </TouchableOpacity>
            ))}
            {done === items.length && <Text style={styles.allSet}>{t('cday_all_set')}</Text>}
          </Section>

          <Section title={t('cday_extras_title')} styles={styles}>
            <View style={styles.extrasRow}>
              <Extra icon="list-outline" label={t('cday_extra_setlist')} styles={styles} colors={colors}
                onPress={() => navigation.navigate('SetlistPrediction', { eventId: data.eventId })} />
              <Extra icon="grid-outline" label={t('cday_extra_bingo')} styles={styles} colors={colors}
                onPress={() => navigation.navigate('ConcertBingo', { eventId: data.eventId, eventName: data.eventName })} />
              <Extra icon="information-circle-outline" label={t('cday_extra_detail')} styles={styles} colors={colors}
                onPress={() => openEvent(navigation, data.eventId)} />
            </View>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

function Hero({ data, receivedAt, t, lang, styles, navigation }) {
  const cd = useCountdown(data.secondsUntilStart, receivedAt);
  const live = data.happeningNow || cd.total === 0;
  const date = parseEventDate(data.eventDate);
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const when = `${date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} · ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;

  // Takvim günü farkı: "yarın" gece yarısına göre, 24 saate göre değil
  const today = new Date();
  const dayDiff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate())
      - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000
  );
  let headline;
  if (live) headline = t('cday_live_headline');
  else if (dayDiff <= 0) headline = t('cday_today_headline');
  else if (dayDiff === 1) headline = t('cday_tomorrow_headline');
  else headline = t('cday_days_headline', { count: dayDiff });

  return (
    <ImageBackground source={data.imageUrl ? { uri: data.imageUrl } : undefined} style={styles.hero}>
      {/* Fotoğraf karartması (yazı okunsun diye) — nötr koyu */}
      <LinearGradient colors={['rgba(10,10,20,0.35)', 'rgba(10,10,20,0.85)', '#0A0A14']} style={styles.heroOverlay}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.back} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroKicker}>{headline}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>{data.artistName || data.eventName}</Text>
        <Text style={styles.heroMeta}>{when}</Text>
        <View style={styles.heroMetaRow}>
          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.82)" />
          <Text style={[styles.heroMeta, { marginTop: 0, flexShrink: 1 }]}>{[data.venueName, data.venueCity].filter(Boolean).join(' · ')}</Text>
        </View>
        {!live && (
          <View style={styles.bigCount}>
            {[
              [cd.days, t('cday_unit_days')], [cd.hours, t('cday_unit_hours')],
              [cd.minutes, t('cday_unit_minutes')], [cd.seconds, t('cday_unit_seconds')],
            ].map(([v, l], i) => (
              <View key={i} style={styles.bigBox}>
                <Text style={styles.bigNum}>{String(v).padStart(2, '0')}</Text>
                <Text style={styles.bigLbl}>{l}</Text>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    </ImageBackground>
  );
}

function WeatherCard({ weather, t, styles, colors }) {
  if (!weather) {
    return (
      <View style={styles.wxCard}>
        <Ionicons name="telescope-outline" size={38} color={colors.textSecondary} />
        <Text style={styles.wxMuted}>{t('cday_weather_later')}</Text>
      </View>
    );
  }
  const look = weatherLook(weather.weatherCode);
  const advice = weatherAdviceKey(weather);
  return (
    <View style={styles.wxCard} accessible accessibilityLabel={`${Math.round(weather.temperature)}° ${t(look.key)}`}>
      <Ionicons name={look.icon} size={42} color={colors.secondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.wxLabel}>{t('cday_weather_title', { hour: String(weather.hour).padStart(2, '0') })}</Text>
        <Text style={styles.wxMain}>
          {Math.round(weather.temperature)}° · {t(look.key)}
        </Text>
        <View style={styles.wxSubRow}>
          <Text style={styles.wxSub}>{t('cday_weather_feels', { temp: Math.round(weather.apparentTemperature) })}</Text>
          <View style={styles.wxSubItem}>
            <Ionicons name="umbrella-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.wxSub}>%{weather.precipitationProbability}</Text>
          </View>
          <View style={styles.wxSubItem}>
            <Ionicons name="speedometer-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.wxSub}>{Math.round(weather.windKmh)} {t('cday_wind_unit')}</Text>
          </View>
        </View>
        {advice && <Text style={styles.wxAdvice}>{t(advice)}</Text>}
      </View>
    </View>
  );
}

function Directions({ data, t, styles, colors }) {
  const hasCoords = data.latitude != null && data.longitude != null;
  const label = [data.venueName, data.venueCity].filter(Boolean).join(', ');
  if (!hasCoords && !label) return null;

  const open = () => {
    const dest = hasCoords ? `${data.latitude},${data.longitude}` : label;
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${encodeURIComponent(dest)}&q=${encodeURIComponent(data.venueName || '')}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <TouchableOpacity onPress={open} activeOpacity={0.85} style={styles.dirBtn} accessibilityRole="button">
      <Ionicons name="navigate-outline" size={26} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.dirTitle}>{t('cday_directions')}</Text>
        <Text style={styles.dirSub} numberOfLines={1}>{data.venueAddress || label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

function Warmup({ tracks, artistName, t, styles, colors }) {
  const [playingIndex, setPlayingIndex] = useState(-1);
  const playerRef = useRef(null);
  const subRef = useRef(null);

  const stop = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    stopPlayer(playerRef.current);
    playerRef.current = null;
    setPlayingIndex(-1);
  }, []);

  const play = useCallback((index) => {
    stop();
    const track = tracks[index];
    if (!track?.previewUrl) return;
    const player = createAudioPlayer(track.previewUrl);
    // Parça bitince sıradakine geç — gerçek bir ısınma listesi gibi
    subRef.current = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        if (index + 1 < tracks.length) play(index + 1);
        else stop();
      }
    });
    playerRef.current = player;
    try {
      player.play();
      setPlayingIndex(index);
    } catch {
      stop();
    }
  }, [tracks, stop]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
    return stop;
  }, [stop]);

  // Ekrandan çıkınca (başka sekmeye ya da ekrana geçince) müzik sussun
  useFocusEffect(useCallback(() => stop, [stop]));

  if (tracks.length === 0) return null;
  return (
    <Section
      title={t('cday_warmup_title')}
      subtitle={t('cday_warmup_sub', { artist: artistName || '' })}
      right={
        <TouchableOpacity
          onPress={() => (playingIndex >= 0 ? stop() : play(0))}
          style={[styles.playAll, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityState={{ selected: playingIndex >= 0 }}
        >
          <Ionicons name={playingIndex >= 0 ? 'stop' : 'play'} size={18} color="#fff" />
        </TouchableOpacity>
      }
      styles={styles}
    >
      {tracks.map((track, i) => {
        const active = i === playingIndex;
        return (
          <TouchableOpacity
            key={`${track.title}-${i}`}
            style={[styles.track, active && styles.trackActive]}
            onPress={() => (active ? stop() : play(i))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={track.title}
          >
            <Text style={styles.trackNo}>{i + 1}</Text>
            {track.coverUrl ? <Image source={{ uri: track.coverUrl }} style={styles.trackCover} /> : null}
            <Text style={[styles.trackTitle, active && { color: colors.primary }]} numberOfLines={1}>{track.title}</Text>
            <Ionicons name={active ? 'pause' : 'play'} size={16} color={active ? colors.primary : colors.textSecondary} style={styles.trackIcon} />
          </TouchableOpacity>
        );
      })}
      <Text style={styles.credit}>{t('cday_warmup_credit')}</Text>
    </Section>
  );
}

function Section({ title, subtitle, right, children, styles }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function Extra({ icon, label, onPress, styles, colors }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.extra} activeOpacity={0.8} accessibilityRole="button">
      <Ionicons name={icon} size={24} color={colors.primary} style={styles.extraEmoji} />
      <Text style={styles.extraLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyEmoji: { marginBottom: 12 },
    emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
    emptyBtn: { marginTop: 20, padding: 10 },
    emptyBtnText: { color: colors.primary, fontSize: 16, fontWeight: '700' },

    hero: { minHeight: 360, backgroundColor: '#14141F' },
    heroOverlay: { flex: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24, justifyContent: 'flex-end' },
    back: { position: 'absolute', top: 48, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
    heroKicker: { color: '#F5A623', fontSize: 13, fontWeight: '900', letterSpacing: 1.4, marginBottom: 6 },
    heroTitle: { color: '#fff', fontSize: 34, fontWeight: '900' },
    heroMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 4 },
    heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    bigCount: { flexDirection: 'row', gap: 10, marginTop: 18 },
    bigBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
    bigNum: { color: '#fff', fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
    bigLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginTop: 2 },

    body: { paddingHorizontal: 16, gap: 14, marginTop: 4 },

    wxCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 16,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    wxLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    wxMain: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
    wxSubRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2, marginTop: 4 },
    wxSubItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    wxSub: { color: colors.textSecondary, fontSize: 12 },
    wxAdvice: { color: colors.secondary, fontSize: 13, fontWeight: '700', marginTop: 8 },
    wxMuted: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 },

    dirBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
    dirTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    dirSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

    section: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
    sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    sectionSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

    friend: { alignItems: 'center', width: 64 },
    friendAvatar: { width: 52, height: 52, borderRadius: 26 },
    friendFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    friendLetter: { color: '#fff', fontSize: 20, fontWeight: '800' },
    friendName: { color: colors.textSecondary, fontSize: 11, marginTop: 6 },

    playAll: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    track: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12 },
    trackActive: { backgroundColor: colors.cardAlt },
    trackNo: { color: colors.textSecondary, width: 18, textAlign: 'center', fontSize: 13, fontWeight: '700' },
    trackCover: { width: 40, height: 40, borderRadius: 8 },
    trackTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
    trackIcon: { width: 24, textAlign: 'center' },
    credit: { color: colors.textSecondary, fontSize: 10, marginTop: 8, textAlign: 'right' },

    progressText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, marginBottom: 8, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
    checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkText: { flex: 1, color: colors.text, fontSize: 15 },
    checkTextDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
    checkTag: { color: '#60A5FA', fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: '#60A5FA', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    allSet: { color: colors.primary, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 10 },

    extrasRow: { flexDirection: 'row', gap: 10 },
    extra: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
    extraEmoji: { marginBottom: 6 },
    extraLabel: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  });
}
