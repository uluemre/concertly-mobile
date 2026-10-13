import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { dateLocale, parseEventDate } from '../utils/time';
import { openInstagram, openWebsite, orgTypeKey } from '../utils/adminOrganizer';

/** Organizatörün herkese açık profili: logo, rozet, açıklama, takip, yaklaşan etkinlikler. */
export default function OrganizerProfileScreen({ navigation, route }) {
  const id = route?.params?.organizerId;
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [o, setO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get(`/organizers/${id}`);
      setO(res.data);
      setError(false);
      setNotFound(false);
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true); else setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFollow = async () => {
    if (!session?.authToken) {
      navigation.navigate('Login');
      return;
    }
    setBusy(true);
    const next = !o.following;
    setO(prev => ({ ...prev, following: next, followers: prev.followers + (next ? 1 : -1) })); // iyimser
    try {
      const res = next ? await API.post(`/organizers/${id}/follow`) : await API.delete(`/organizers/${id}/follow`);
      setO(prev => ({ ...prev, following: res.data.following, followers: res.data.followers }));
    } catch {
      setO(prev => ({ ...prev, following: !next, followers: prev.followers + (next ? -1 : 1) }));
      Alert.alert(t('error'), t('org_action_failed'));
    } finally {
      setBusy(false);
    }
  };

  const share = () => Share.share({ message: `${o.name} · Concertly` }).catch(() => {});

  const fmt = (iso) => parseEventDate(iso).toLocaleString(dateLocale(lang), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      {o ? (
        <TouchableOpacity onPress={share} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('share')}>
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (loading) return <View style={styles.container}>{header}<View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></View>;
  if (notFound || error || !o) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Ionicons name={notFound ? 'business-outline' : 'cloud-offline-outline'} size={48} color={colors.textSecondary} />
          <Text style={styles.muted}>{notFound ? t('orgp_not_found') : t('org_load_error')}</Text>
          {!notFound ? (
            <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={styles.primaryBtn} accessibilityRole="button">
              <Text style={styles.primaryText}>{t('retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            {o.logoUrl ? <Image source={{ uri: o.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="business" size={40} color={colors.primary} />}
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name} accessibilityRole="header">{o.name}</Text>
            {o.verified ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} accessibilityLabel={t('orgp_verified')} /> : null}
          </View>
          <Text style={styles.muted}>{t(orgTypeKey(o.type))}</Text>
          <View style={styles.counts}>
            <Text style={styles.count}><Text style={styles.countNum}>{o.followers}</Text>{` ${t('orgp_followers')}`}</Text>
            <Text style={styles.count}><Text style={styles.countNum}>{(o.upcoming || []).length}</Text>{` ${t('orgp_upcoming')}`}</Text>
            <Text style={styles.count}><Text style={styles.countNum}>{o.pastCount}</Text>{` ${t('orgp_past')}`}</Text>
          </View>
          {o.isOwner ? (
            <TouchableOpacity onPress={() => navigation.navigate('OrganizerProfileEdit')} style={styles.outlineBtn} accessibilityRole="button">
              <Ionicons name="create-outline" size={16} color={colors.text} />
              <Text style={styles.outlineText}>{t('orgp_edit')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={toggleFollow}
              disabled={busy}
              style={[styles.followBtn, o.following && styles.followingBtn]}
              accessibilityRole="button"
              accessibilityState={{ selected: !!o.following }}
            >
              <Ionicons name={o.following ? 'checkmark' : 'add'} size={16} color={o.following ? colors.text : '#fff'} />
              <Text style={[styles.followText, o.following && { color: colors.text }]}>{o.following ? t('orgp_following') : t('orgp_follow')}</Text>
            </TouchableOpacity>
          )}
          {!o.isOwner ? <Text style={styles.small}>{t('orgp_follow_hint')}</Text> : null}
        </View>

        {o.bio ? <Text style={styles.bio}>{o.bio}</Text> : null}

        {o.website || o.instagram ? (
          <View style={styles.links}>
            {o.website ? (
              <TouchableOpacity style={styles.link} onPress={() => openWebsite(o.website)} accessibilityRole="link">
                <Ionicons name="globe-outline" size={16} color={colors.primary} />
                <Text style={styles.linkText} numberOfLines={1}>{o.website.replace(/^https?:\/\//, '')}</Text>
              </TouchableOpacity>
            ) : null}
            {o.instagram ? (
              <TouchableOpacity style={styles.link} onPress={() => openInstagram(o.instagram)} accessibilityRole="link">
                <Ionicons name="logo-instagram" size={16} color={colors.primary} />
                <Text style={styles.linkText} numberOfLines={1}>{o.instagram}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.section}>{t('orgp_upcoming_title')}</Text>
        {(o.upcoming || []).length === 0 ? <Text style={styles.empty}>{t('orgp_no_upcoming')}</Text> : o.upcoming.map(e => (
          <TouchableOpacity key={e.id} style={styles.event} onPress={() => openEvent(navigation, e.id)} activeOpacity={0.85} accessibilityRole="button">
            <View style={styles.eventImg}>
              {e.imageUrl ? <Image source={{ uri: e.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="musical-notes" size={20} color={colors.textSecondary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventName} numberOfLines={2}>{e.name}</Text>
              <Text style={styles.small} numberOfLines={1}>{fmt(e.eventDate)}</Text>
              <Text style={styles.small} numberOfLines={1}>
                {[e.venueName, e.venueCity].filter(Boolean).join(' · ')}{e.going > 0 ? ` · ${t('dash_going_n', { count: e.going })}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 6 },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, gap: 14 },
    hero: { alignItems: 'center', gap: 6 },
    logo: {
      width: 96, height: 96, borderRadius: 24, overflow: 'hidden', marginBottom: 6,
      backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center',
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
    name: { fontSize: 24, fontFamily: fonts.heading, color: colors.text, textAlign: 'center' },
    muted: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    small: { fontSize: 12, color: colors.textSecondary },
    counts: { flexDirection: 'row', gap: 16, marginTop: 6 },
    count: { fontSize: 13, color: colors.textSecondary },
    countNum: { fontWeight: '800', color: colors.text },
    followBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
      backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10,
    },
    followingBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    followText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    outlineBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
      borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18, paddingVertical: 9,
    },
    outlineText: { color: colors.text, fontWeight: '700' },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
    primaryText: { color: '#fff', fontWeight: '700' },
    bio: { fontSize: 14, color: colors.text, lineHeight: 21, textAlign: 'center' },
    links: { gap: 8 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
    linkText: { flex: 1, color: colors.primary, fontWeight: '600' },
    section: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.text, marginTop: 6 },
    empty: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 },
    event: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 },
    eventImg: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    eventName: { fontSize: 15, fontWeight: '700', color: colors.text },
  });
}
