import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API, { getErrorMessage } from '../services/api';

export default function CommunityManageScreen({ route, navigation }) {
  const { communityId } = route.params;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [community, setCommunity] = useState(null);
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isOwner = community?.currentUserRole === 'OWNER';

  const fetchAll = useCallback(async () => {
    try {
      const [c, reqs, mem] = await Promise.all([
        API.get(`/communities/${communityId}`),
        API.get(`/communities/${communityId}/requests`).catch(() => ({ data: [] })),
        API.get(`/communities/${communityId}/members`),
      ]);
      setCommunity(c.data);
      setRequests(reqs.data);
      setMembers(mem.data);
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [communityId, t]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const roleLabel = (role) => role === 'OWNER' ? t('community_role_owner')
    : role === 'MODERATOR' ? t('community_role_moderator') : t('community_role_member');

  const act = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await fetchAll();
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const approve = (userId) => act(() => API.post(`/communities/${communityId}/requests/${userId}/approve`));
  const reject  = (userId) => act(() => API.post(`/communities/${communityId}/requests/${userId}/reject`));
  const makeMod = (userId) => act(() => API.post(`/communities/${communityId}/members/${userId}/role`, null, { params: { role: 'MODERATOR' } }));
  const removeMod = (userId) => act(() => API.post(`/communities/${communityId}/members/${userId}/role`, null, { params: { role: 'MEMBER' } }));
  const kick = (userId, username) => {
    Alert.alert(t('community_manage_kick'), `@${username}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('community_manage_kick'), style: 'destructive',
        onPress: () => act(() => API.delete(`/communities/${communityId}/members/${userId}`)) },
    ]);
  };

  const regenerate = () => act(async () => {
    const res = await API.post(`/communities/${communityId}/invite-code/regenerate`);
    setCommunity(prev => prev ? { ...prev, inviteCode: res.data.inviteCode } : prev);
  });

  const shareInvite = async () => {
    if (!community?.inviteCode) return;
    try {
      await Share.share({
        message: t('community_invite_share_msg', { name: community.name, code: community.inviteCode }),
      });
    } catch {}
  };

  const deleteCommunity = () => {
    Alert.alert(t('community_manage_delete'), t('community_manage_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('community_manage_delete'), style: 'destructive',
        onPress: async () => {
          try {
            await API.delete(`/communities/${communityId}`);
            navigation.navigate('Communities');
          } catch (err) {
            Alert.alert(t('error'), getErrorMessage(err));
          }
        } },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('community_manage_title')}</Text>
        <Text style={styles.headerSub} numberOfLines={1}>{community?.emoji} {community?.name}</Text>
      </LinearGradient>

      {/* DAVET KODU */}
      <Text style={styles.sectionTitle}>{t('community_manage_invite_link')}</Text>
      <View style={styles.inviteCard}>
        <Text style={styles.inviteCode}>{community?.inviteCode || '—'}</Text>
        <Text style={styles.inviteHint}>{t('community_manage_invite_hint')}</Text>
        <View style={styles.inviteBtnRow}>
          <TouchableOpacity onPress={shareInvite} style={[styles.inviteBtn, styles.inviteBtnPrimary]} activeOpacity={0.85}>
            <Text style={styles.inviteBtnPrimaryText}>↗ {t('community_manage_share')}</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={regenerate} style={styles.inviteBtn} activeOpacity={0.85}>
              <Text style={styles.inviteBtnText}>🔄 {t('community_manage_regenerate')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* KATILMA İSTEKLERİ */}
      <Text style={styles.sectionTitle}>
        {t('community_manage_requests')}{requests.length > 0 ? ` (${requests.length})` : ''}
      </Text>
      {requests.length === 0 ? (
        <Text style={styles.empty}>{t('community_manage_no_requests')}</Text>
      ) : requests.map(r => (
        <View key={r.userId} style={styles.row}>
          <Avatar user={r} styles={styles} />
          <Text style={styles.username} numberOfLines={1}>@{r.username}</Text>
          <TouchableOpacity onPress={() => approve(r.userId)} style={[styles.smallBtn, styles.approveBtn]} disabled={busy}>
            <Text style={styles.approveText}>{t('community_manage_approve')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => reject(r.userId)} style={[styles.smallBtn, styles.rejectBtn]} disabled={busy}>
            <Text style={styles.rejectText}>{t('community_manage_reject')}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* ÜYELER */}
      <Text style={styles.sectionTitle}>{t('community_manage_members')} ({members.length})</Text>
      {members.map(m => (
        <View key={m.userId} style={styles.row}>
          <Avatar user={m} styles={styles} />
          <View style={{ flex: 1 }}>
            <Text style={styles.username} numberOfLines={1}>@{m.username}</Text>
            <Text style={styles.roleText}>{roleLabel(m.role)}</Text>
          </View>
          {/* Rol işlemleri yalnızca sahibe, OWNER dışı üyeler için */}
          {isOwner && m.role !== 'OWNER' && (
            <>
              {m.role === 'MODERATOR' ? (
                <TouchableOpacity onPress={() => removeMod(m.userId)} style={styles.smallBtn} disabled={busy}>
                  <Text style={styles.smallBtnText}>{t('community_manage_remove_mod')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => makeMod(m.userId)} style={styles.smallBtn} disabled={busy}>
                  <Text style={styles.smallBtnText}>{t('community_manage_make_mod')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => kick(m.userId, m.username)} style={[styles.smallBtn, styles.rejectBtn]} disabled={busy}>
                <Text style={styles.rejectText}>{t('community_manage_kick')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}

      {/* SİL (yalnız sahip) */}
      {isOwner && (
        <TouchableOpacity onPress={deleteCommunity} style={styles.deleteBtn} activeOpacity={0.85}>
          <Text style={styles.deleteText}>🗑 {t('community_manage_delete')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Avatar({ user, styles }) {
  if (user.profileImageUrl) {
    return <Image source={{ uri: user.profileImageUrl }} style={styles.avatar} />;
  }
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{(user.username || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { paddingTop: 56, paddingBottom: 22, paddingHorizontal: 20 },
    backButton: { alignSelf: 'flex-start', marginBottom: 14 },
    backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    headerTitle: { color: colors.text, fontSize: 24, fontWeight: 'bold' },
    headerSub: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
    sectionTitle: {
      color: colors.textSecondary, fontSize: 11, fontWeight: '800',
      letterSpacing: 1.2, textTransform: 'uppercase',
      marginHorizontal: 18, marginTop: 24, marginBottom: 12,
    },
    inviteCard: {
      marginHorizontal: 16, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16,
    },
    inviteCode: {
      color: colors.text, fontSize: 26, fontWeight: '900',
      letterSpacing: 4, textAlign: 'center', marginBottom: 6,
    },
    inviteHint: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 12 },
    inviteBtnRow: { flexDirection: 'row', gap: 10 },
    inviteBtn: {
      flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
      backgroundColor: colors.cardAlt || colors.background, borderWidth: 1, borderColor: colors.border,
    },
    inviteBtnText: { color: colors.text, fontSize: 13, fontWeight: '800' },
    inviteBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    inviteBtnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    empty: { color: colors.textSecondary, fontSize: 13, marginHorizontal: 18 },
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
    smallBtn: {
      paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
      backgroundColor: colors.cardAlt || colors.background, borderWidth: 1, borderColor: colors.border,
    },
    smallBtnText: { color: colors.text, fontSize: 11, fontWeight: '800' },
    approveBtn: { backgroundColor: '#00D4AA', borderColor: '#00D4AA' },
    approveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    rejectBtn: { backgroundColor: '#E9456020', borderColor: '#E94560' },
    rejectText: { color: '#E94560', fontSize: 11, fontWeight: '800' },
    deleteBtn: {
      marginHorizontal: 16, marginTop: 28, paddingVertical: 15, borderRadius: 14,
      borderWidth: 1, borderColor: '#E94560', alignItems: 'center',
    },
    deleteText: { color: '#E94560', fontSize: 14, fontWeight: '900' },
  });
}
