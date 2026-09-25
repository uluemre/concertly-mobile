// "Konsere Hazırlan": gideceğin konser için tek ekran — canlı geri sayım,
// konser saatindeki hava + öneri, yol tarifi, gelen arkadaşlar, sanatçının
// en sevilen şarkılarından ısınma listesi ve havaya göre değişen hazırlık listesi.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Linking, Platform, ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import API from '../services/api';
import { useTheme } from '../theme';
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
        <Text style={styles.emptyEmoji}>🎫</Text>
        <Text style={styles.emptyText}>{t('cday_load_error')}</Text>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.emptyBtn}>
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
          <WeatherCard weather={data.weather} t={t} styles={styles} />

          <Directions data={data} t={t} styles={styles} />

          {data.friendsGoing?.length > 0 && (
            <Section title={t('cday_friends_title', { count: data.friendsGoing.length })} styles={styles}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {data.friendsGoing.map(f => (
                  <TouchableOpacity
                    key={f.userId}
                    style={styles.friend}
                    onPress={() => navigation.navigate('UserProfile', { userId: f.userId })}
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
              <TouchableOpacity key={item.id} style={styles.checkRow} onPress={() => toggle(item.id)} activeOpacity={0.7}>
                <View style={[styles.checkBox, checked[item.id] && styles.checkBoxOn]}>
                  {checked[item.id] && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.checkEmoji}>{item.emoji}</Text>
                <Text style={[styles.checkText, checked[item.id] && styles.checkTextDone]}>{t(item.key)}</Text>
                {item.weather && <Text style={styles.checkTag}>{t('cday_weather_tag')}</Text>}
              </TouchableOpacity>
            ))}
            {done === items.length && <Text style={styles.allSet}>{t('cday_all_set')}</Text>}
          </Section>

          <Section title={t('cday_extras_title')} styles={styles}>
            <View style={styles.extrasRow}>
              <Extra emoji="🔮" label={t('cday_extra_setlist')} styles={styles}
                onPress={() => navigation.navigate('SetlistPrediction', { eventId: data.eventId })} />
              <Extra emoji="🎯" label={t('cday_extra_bingo')} styles={styles}
                onPress={() => navigation.navigate('ConcertBingo', { eventId: data.eventId, eventName: data.eventName })} />
              <Extra emoji="🎫" label={t('cday_extra_detail')} styles={styles}
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
      <LinearGradient colors={['rgba(10,10,20,0.35)', 'rgba(26,10,46,0.85)', '#0A0A14']} style={styles.heroOverlay}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.heroKicker}>{headline}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>{data.artistName || data.eventName}</Text>
        <Text style={styles.heroMeta}>{when}</Text>
        <Text style={styles.heroMeta}>📍 {[data.venueName, data.venueCity].filter(Boolean).join(' · ')}</Text>
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

function WeatherCard({ weather, t, styles }) {
  if (!weather) {
    return (
      <View style={styles.wxCard}>
        <Text style={styles.wxEmoji}>🔭</Text>
        <Text style={styles.wxMuted}>{t('cday_weather_later')}</Text>
      </View>
    );
  }
  const look = weatherLook(weather.weatherCode);
  const advice = weatherAdviceKey(weather);
  return (
    <LinearGradient colors={['#1E1B4B', '#312E81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wxCard}>
      <Text style={styles.wxEmoji}>{look.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.wxLabel}>{t('cday_weather_title', { hour: String(weather.hour).padStart(2, '0') })}</Text>
        <Text style={styles.wxMain}>
          {Math.round(weather.temperature)}° · {t(look.key)}
        </Text>
        <Text style={styles.wxSub}>
          {t('cday_weather_feels', { temp: Math.round(weather.apparentTemperature) })}
          {'  ·  '}☔ %{weather.precipitationProbability}
          {'  ·  '}💨 {Math.round(weather.windKmh)} {t('cday_wind_unit')}
        </Text>
        {advice && <Text style={styles.wxAdvice}>{t(advice)}</Text>}
      </View>
    </LinearGradient>
  );
}

function Directions({ data, t, styles }) {
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
    <TouchableOpacity onPress={open} activeOpacity={0.85} style={styles.dirBtn}>
      <Text style={styles.dirEmoji}>🧭</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.dirTitle}>{t('cday_directions')}</Text>
        <Text style={styles.dirSub} numberOfLines={1}>{data.venueAddress || label}</Text>
      </View>
      <Text style={styles.dirArrow}>›</Text>
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
        >
          <Text style={styles.playAllText}>{playingIndex >= 0 ? '■' : '▶'}</Text>
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
          >
            <Text style={styles.trackNo}>{i + 1}</Text>
            {track.coverUrl ? <Image source={{ uri: track.coverUrl }} style={styles.trackCover} /> : null}
            <Text style={[styles.trackTitle, active && { color: colors.primary }]} numberOfLines={1}>{track.title}</Text>
            <Text style={[styles.trackIcon, active && { color: colors.primary }]}>{active ? '❚❚' : '▶'}</Text>
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

function Extra({ emoji, label, onPress, styles }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.extra} activeOpacity={0.8}>
      <Text style={styles.extraEmoji}>{emoji}</Text>
      <Text style={styles.extraLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
    emptyBtn: { marginTop: 20, padding: 10 },
    emptyBtnText: { color: colors.primary, fontSize: 16, fontWeight: '700' },

    hero: { minHeight: 360, backgroundColor: '#1a0a2e' },
    heroOverlay: { flex: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24, justifyContent: 'flex-end' },
    back: { position: 'absolute', top: 48, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
    backText: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: -3 },
    heroKicker: { color: '#F5A623', fontSize: 13, fontWeight: '900', letterSpacing: 1.4, marginBottom: 6 },
    heroTitle: { color: '#fff', fontSize: 34, fontWeight: '900' },
    heroMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 4 },
    bigCount: { flexDirection: 'row', gap: 10, marginTop: 18 },
    bigBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
    bigNum: { color: '#fff', fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
    bigLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginTop: 2 },

    body: { paddingHorizontal: 16, gap: 14, marginTop: 4 },

    wxCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 16, backgroundColor: colors.card },
    wxEmoji: { fontSize: 42 },
    wxLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
    wxMain: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 },
    wxSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
    wxAdvice: { color: '#FDE68A', fontSize: 13, fontWeight: '700', marginTop: 8 },
    wxMuted: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 },

    dirBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
    dirEmoji: { fontSize: 28 },
    dirTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    dirSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    dirArrow: { color: colors.textSecondary, fontSize: 28 },

    section: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
    sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    sectionSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

    friend: { alignItems: 'center', width: 64 },
    friendAvatar: { width: 52, height: 52, borderRadius: 26 },
    friendFallback: { backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
    friendLetter: { color: '#fff', fontSize: 20, fontWeight: '800' },
    friendName: { color: colors.textSecondary, fontSize: 11, marginTop: 6 },

    playAll: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    playAllText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    track: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12 },
    trackActive: { backgroundColor: colors.cardAlt },
    trackNo: { color: colors.textSecondary, width: 18, textAlign: 'center', fontSize: 13, fontWeight: '700' },
    trackCover: { width: 40, height: 40, borderRadius: 8 },
    trackTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
    trackIcon: { color: colors.textSecondary, fontSize: 13, width: 24, textAlign: 'center' },
    credit: { color: colors.textSecondary, fontSize: 10, marginTop: 8, textAlign: 'right' },

    progressText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, marginBottom: 8, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
    checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkMark: { color: '#fff', fontSize: 14, fontWeight: '900' },
    checkEmoji: { fontSize: 18 },
    checkText: { flex: 1, color: colors.text, fontSize: 15 },
    checkTextDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
    checkTag: { color: '#60A5FA', fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: '#60A5FA', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    allSet: { color: colors.primary, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 10 },

    extrasRow: { flexDirection: 'row', gap: 10 },
    extra: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
    extraEmoji: { fontSize: 26, marginBottom: 6 },
    extraLabel: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  });
}
