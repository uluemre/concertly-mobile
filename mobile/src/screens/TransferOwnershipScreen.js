import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { communityErrorMessage } from '../utils/communityErrors';
import DeepLinkLoader from '../components/DeepLinkLoader';

export default function TransferOwnershipScreen({ route, navigation }) {
  const { communityId } = route.params;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { session } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    try {
      const [c, mem] = await Promise.all([
        API.get(`/communities/${communityId}`),
        API.get(`/communities/${communityId}/members`),
      ]);
      // Yalnızca sahip görebilir; diğerleri topluluk detayına döner
      if (c.data?.currentUserRole !== 'OWNER') {
        navigation.replace('CommunityDetail', { communityId });
        return;
      }
      setCommunity(c.data);
      setMembers(Array.isArray(mem.data) ? mem.data : []);
    } catch (err) {
      if (err?.response?.status === 404) { setNotFound(true); return; }
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }, [communityId, t, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const candidates = members.filter(m =>
    String(m.userId) !== String(session?.userId) && m.role !== 'OWNER' && (!m.status || m.status === 'ACTIVE'));

  const doTransfer = async (m) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await API.post(`/communities/${communityId}/transfer/${m.userId}`);
      Alert.alert(t('success'), t('community_transfer_done'));
      // Detay yığında varsa oraya dön (yeni kopya itme); yoksa değiştir. Detay odakta yenilenir.
      const routes = navigation.getState?.()?.routes || [];
      if (routes.some(r => r.name === 'CommunityDetail') && navigation.popTo) {
        navigation.popTo('CommunityDetail', { communityId });
      } else {
        navigation.replace('CommunityDetail', { communityId });
      }
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const confirmTransfer = (m) => {
    if (busy) return;
    Alert.alert(t('community_transfer_title'), t('community_transfer_confirm', { name: m.username }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('community_transfer_action'), style: 'destructive', onPress: () => doTransfer(m) },
    ]);
  };

  if (notFound) return <DeepLinkLoader error onBack={() => goBackOrFallback(navigation)} />;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backButton}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('community_transfer_title')}</Text>
        <Text style={styles.headerSub} numberOfLines={1}>{community?.emoji} {community?.name}</Text>
        <Text style={styles.hint}>{t('community_transfer_hint')}</Text>
      </View>

      {candidates.length === 0 ? (
        <Text style={styles.empty}>{t('community_transfer_empty')}</Text>
      ) : candidates.map(m => (
        <TouchableOpacity key={m.userId} style={styles.row} onPress={() => confirmTransfer(m)} disabled={busy} activeOpacity={0.85}>
          {m.profileImageUrl ? (
            <Image source={{ uri: m.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(m.username || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.username} numberOfLines={1}>@{m.username}</Text>
            <Text style={styles.roleText}>
              {m.role === 'MODERATOR' ? t('community_role_moderator') : t('community_role_member')}
            </Text>
          </View>
          <Text style={styles.action}>{t('community_transfer_action')}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20 },
    backButton: { alignSelf: 'flex-start', marginBottom: 14 },
    backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    headerTitle: { color: colors.text, fontSize: 24, fontWeight: 'bold' },
    headerSub: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
    hint: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
    empty: { color: colors.textSecondary, fontSize: 13, marginHorizontal: 18, marginTop: 12 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginBottom: 10, padding: 12,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    },
    avatar: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.cardAlt || colors.background,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    avatarText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
    username: { color: colors.text, fontSize: 14, fontWeight: '800' },
    roleText: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    action: { color: '#E94560', fontSize: 12, fontWeight: '800' },
  });
}
