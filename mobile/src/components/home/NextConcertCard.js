// Ana sayfa: "Sıradaki konserin" — gidiyorum dediğin en yakın konsere canlı geri sayım.
// Açılışta ince bir şerit olarak durur, dokununca büyük karta açılır.
// Konser yoksa hiçbir şey çizmez.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ImageBackground, Animated, Image, LayoutAnimation,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useFocusEffect } from '@react-navigation/native';
import API from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useCountdown, weatherLook } from '../../utils/concertDay';

export default function NextConcertCard({ navigation }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [receivedAt, setReceivedAt] = useState(Date.now());

  useFocusEffect(useCallback(() => {
    let alive = true;
    API.get('/concert-day/next')
      .then(res => {
        if (!alive) return;
        setData(res.status === 204 ? null : res.data || null);
        setReceivedAt(Date.now());
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []));

  if (!data) return null;
  return (
    <Card
      data={data}
      receivedAt={receivedAt}
      t={t}
      onPress={() => navigation.navigate('ConcertPrep', { eventId: data.eventId })}
    />
  );
}

function Card({ data, receivedAt, t, onPress }) {
  const { colors } = useTheme();
  const cd = useCountdown(data.secondsUntilStart, receivedAt);
  const live = data.happeningNow || cd.total === 0;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!live) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  const [expanded, setExpanded] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
    setExpanded(e => !e);
  };

  const wx = data.weather ? weatherLook(data.weather.weatherCode) : null;
  const friends = data.friendsGoing || [];
  const units = useMemo(() => ([
    { v: cd.days, l: t('cday_unit_days') },
    { v: cd.hours, l: t('cday_unit_hours') },
    { v: cd.minutes, l: t('cday_unit_minutes') },
    { v: cd.seconds, l: t('cday_unit_seconds') },
  ]), [cd.days, cd.hours, cd.minutes, cd.seconds, t]);

  if (!expanded) {
    const pad = (n) => String(n).padStart(2, '0');
    const clock = cd.days > 0
      ? `${cd.days}${t('cday_short_days')} ${pad(cd.hours)}:${pad(cd.minutes)}:${pad(cd.seconds)}`
      : `${pad(cd.hours)}:${pad(cd.minutes)}:${pad(cd.seconds)}`;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={toggle}
        style={styles.stripWrap}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={`${live ? t('cday_live') : t('cday_next_title')}: ${data.artistName || data.eventName}${live ? '' : `, ${clock}`}`}
      >
        {/* Ekran zemininde duran şerit: tema renkleri (açık temada da okunur) */}
        <View style={[styles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {data.imageUrl
            ? <Image source={{ uri: data.imageUrl }} style={styles.stripThumb} />
            : (
              <View style={[styles.stripThumb, styles.avatarFallback]}>
                <Ionicons name="ticket" size={18} color="#fff" />
              </View>
            )}
          <View style={styles.stripText}>
            <Text style={[styles.stripKicker, { color: colors.primary }]} numberOfLines={1}>{live ? t('cday_live') : t('cday_next_title')}</Text>
            <Text style={[styles.stripTitle, { color: colors.text }]} numberOfLines={1}>{data.artistName || data.eventName}</Text>
          </View>
          {live ? (
            <Animated.View style={[styles.stripLiveDot, { opacity: pulse }]} />
          ) : (
            <Text style={[styles.stripClock, { color: colors.text }]}>{clock}</Text>
          )}
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={styles.stripChevron} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.wrap} accessibilityRole="button" accessibilityLabel={`${t('cday_next_title')}: ${data.artistName || data.eventName}`}>
      <ImageBackground
        source={data.imageUrl ? { uri: data.imageUrl } : undefined}
        style={styles.card}
        imageStyle={styles.image}
      >
        {/* Fotoğraf karartması: yazı okunsun diye (nötr koyu, mor tonu yok) */}
        <LinearGradient
          colors={['rgba(10,10,20,0.45)', 'rgba(10,10,20,0.92)']}
          start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }}
          style={styles.overlay}
        >
          <View style={styles.topRow}>
            {live ? (
              <View style={styles.liveChip}>
                <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
                <Text style={styles.liveText}>{t('cday_live')}</Text>
              </View>
            ) : (
              <Text style={styles.kicker}>{t('cday_next_title')}</Text>
            )}
            <View style={styles.topRight}>
              {wx && (
                <View style={[styles.wxChip, styles.wxRow]} accessibilityLabel={`${t(wx.key)} ${Math.round(data.weather.temperature)}°`}>
                  <Ionicons name={wx.icon} size={14} color="#fff" />
                  <Text style={styles.wxText}>{Math.round(data.weather.temperature)}°</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={toggle}
                hitSlop={12}
                style={styles.collapseBtn}
                accessibilityRole="button"
                accessibilityState={{ expanded: true }}
              >
                <Ionicons name="chevron-up" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={1}>{data.artistName || data.eventName}</Text>
          <View style={styles.venueRow}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.venue} numberOfLines={1}>{[data.venueName, data.venueCity].filter(Boolean).join(' · ')}</Text>
          </View>

          {!live && (
            <View style={styles.countRow}>
              {units.map((u, i) => (
                <View key={i} style={styles.countBox}>
                  <Text style={styles.countNum}>{String(u.v).padStart(2, '0')}</Text>
                  <Text style={styles.countLbl}>{u.l}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.footer}>
            {friends.length > 0 ? (
              <View style={styles.friends}>
                {friends.slice(0, 3).map((f, i) => (
                  f.profileImageUrl
                    ? <Image key={f.userId} source={{ uri: f.profileImageUrl }} style={[styles.avatar, { marginLeft: i ? -8 : 0 }]} />
                    : (
                      <View key={f.userId} style={[styles.avatar, styles.avatarFallback, { marginLeft: i ? -8 : 0 }]}>
                        <Text style={styles.avatarLetter}>{(f.username || '?')[0].toUpperCase()}</Text>
                      </View>
                    )
                ))}
                <Text style={styles.friendsText}>{t('cday_friends_going', { count: friends.length })}</Text>
              </View>
            ) : <View />}
            <View style={styles.cta}>
              <Text style={styles.ctaText}>{t('cday_prepare')}</Text>
              <Ionicons name="arrow-forward" size={14} color="#0F0F1A" />
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 16, borderRadius: 22, overflow: 'hidden' },
  stripWrap: { marginHorizontal: 20, marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 16, borderWidth: 1,
  },
  stripThumb: { width: 36, height: 36, borderRadius: 10 },
  stripText: { flex: 1 },
  stripKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  stripTitle: { fontSize: 14, fontWeight: '800', marginTop: 1 },
  stripClock: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stripLiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E94560' },
  stripChevron: { marginLeft: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  // Fotoğraflı kart her iki temada da koyu yüzey (beyaz yazı)
  card: { minHeight: 200, backgroundColor: '#14141F' },
  image: { borderRadius: 22 },
  overlay: { flex: 1, padding: 18, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  liveChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(233,69,96,0.9)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 6 },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  wxChip: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  wxRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wxText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 10 },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  venue: { color: 'rgba(255,255,255,0.8)', fontSize: 13, flexShrink: 1 },
  countRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  countBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  countNum: { color: '#fff', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  countLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', marginTop: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  friends: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#14141F' },
  avatarFallback: { backgroundColor: '#E94560', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 11, fontWeight: '800' },
  friendsText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 6, flexShrink: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  ctaText: { color: '#0F0F1A', fontSize: 13, fontWeight: '800' },
});
