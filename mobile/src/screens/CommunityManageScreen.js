import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { buildShareUrl, shareWithLink } from '../services/shareLinks';
import API from '../services/api';
import { goBackOrFallback, backToCommunities } from '../navigation/navHelpers';
import { communityErrorMessage } from '../utils/communityErrors';
import DeepLinkLoader from '../components/DeepLinkLoader';

// İkon + metin buton etiketi (eski emoji önekleri yerine)
function IconLabel({ icon, color, style, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={style}>{children}</Text>
    </View>
  );
}

export default function CommunityManageScreen({ route, navigation }) {
  const { communityId } = route.params;
  const { colors } = useTheme();
  const { t, tu } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [community, setCommunity] = useState(null);
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Bildirimden silinmiş topluluğa gelinirse "bulunamadı" gösterilir (A3)
  const [notFound, setNotFound] = useState(false);

  const isOwner = community?.currentUserRole === 'OWNER';
  const isModerator = community?.currentUserRole === 'MODERATOR';

  const fetchAll = useCallback(async () => {
    try {
      const [c, reqs, mem, banned] = await Promise.all([
        API.get(`/communities/${communityId}`),
        API.get(`/communities/${communityId}/requests`).catch(() => ({ data: [] })),
        API.get(`/communities/${communityId}/members`),
        API.get(`/communities/${communityId}/bans`).catch(() => ({ data: [] })),
      ]);
      // Artık yönetici değilse (ör. yetkisi alınmış) yönetim yerine topluluk detayı açılır
      if (!c.data?.canManage) {
        navigation.replace('CommunityDetail', { communityId });
        return;
      }
      setCommunity(c.data);
      setRequests(reqs.data);
      setMembers(mem.data);
      setBans(Array.isArray(banned.data) ? banned.data : []);
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
        return;
      }
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }, [communityId, t, navigation]);

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
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const approve = (userId) => community?.archived ? undefined : act(() => API.post(`/communities/${communityId}/requests/${userId}/approve`));
  const reject  = (userId) => act(() => API.post(`/communities/${communityId}/requests/${userId}/reject`));
  const makeMod = (userId) => act(() => API.post(`/communities/${communityId}/members/${userId}/role`, null, { params: { role: 'MODERATOR' } }));
  const removeMod = (userId) => act(() => API.post(`/communities/${communityId}/members/${userId}/role`, null, { params: { role: 'MEMBER' } }));
  const kick = (userId, username) => {
    // Sunucuda çıkarma artık yasaklama (BANNED) anlamına gelir (B7)
    Alert.alert(t('community_manage_ban'), t('community_manage_ban_confirm', { name: username }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('community_manage_ban'), style: 'destructive',
        onPress: () => act(() => API.delete(`/communities/${communityId}/members/${userId}`)) },
    ]);
  };
  const unban = (userId, username) => {
    Alert.alert(t('community_manage_unban'), t('community_manage_unban_confirm', { name: username }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('community_manage_unban'),
        onPress: () => act(() => API.delete(`/communities/${communityId}/bans/${userId}`)) },
    ]);
  };

  const regenerate = () => act(async () => {
    const res = await API.post(`/communities/${communityId}/invite-code/regenerate`);
    setCommunity(prev => prev ? { ...prev, inviteCode: res.data.inviteCode } : prev);
  });

  const shareInvite = async () => {
    if (!community?.inviteCode) return;
    // Davet koduna topluluk linki de eklenir; link uygulamayı doğrudan açar.
    await shareWithLink(
      t('community_invite_share_msg', { name: community.name, code: community.inviteCode }),
      buildShareUrl('community', communityId)
    );
  };

  // Moderatör topluluktan ayrılabilir (A4); sahip ayrılamaz, onun için "Sil" var.
  // act() kullanılmaz: ayrıldıktan sonra topluluğu yeniden çekmek gizli toplulukta 404 verir.
  const leaveCommunity = () => {
    Alert.alert(t('community_leave'), t('community_leave_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('community_leave'), style: 'destructive',
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          try {
            await API.delete(`/communities/${communityId}/join`);
            // Detaya dönülmez: gizli topluluktan ayrılan moderatör artık erişemeyebilir
            backToCommunities(navigation);
          } catch (err) {
            Alert.alert(t('error'), communityErrorMessage(err, t));
          } finally {
            setBusy(false);
          }
        } },
    ]);
  };

  const deleteCommunity = () => {
    Alert.alert(t('community_manage_delete'), t('community_manage_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('community_manage_delete'), style: 'destructive',
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          try {
            await API.delete(`/communities/${communityId}`);
            // Silinen topluluk geri yığınında kalmasın (C8)
            backToCommunities(navigation);
          } catch (err) {
            Alert.alert(t('error'), communityErrorMessage(err, t));
          } finally {
            setBusy(false);
          }
        } },
    ]);
  };

  if (notFound) {
    return <DeepLinkLoader error onBack={() => goBackOrFallback(navigation)} />;
  }

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
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('community_manage_title')}</Text>
        <Text style={styles.headerSub} numberOfLines={1}>{community?.emoji} {community?.name}</Text>
      </View>

      {/* DAVET KODU */}
      <Text style={styles.sectionTitle}>{tu('community_manage_invite_link')}</Text>
      <View style={styles.inviteCard}>
        <Text style={styles.inviteCode}>{community?.inviteCode || '—'}</Text>
        <Text style={styles.inviteHint}>{t(community?.archived ? 'community_archived_info' : 'community_manage_invite_hint')}</Text>
        {!community?.archived && (
        <View style={styles.inviteBtnRow}>
          <TouchableOpacity onPress={shareInvite} style={[styles.inviteBtn, styles.inviteBtnPrimary]} activeOpacity={0.85} accessibilityRole="button">
            <IconLabel icon="share-outline" color="#fff" style={styles.inviteBtnPrimaryText}>{t('community_manage_share')}</IconLabel>
          </TouchableOpacity>
          {!!community?.canManage && (
            <TouchableOpacity onPress={regenerate} disabled={busy} style={styles.inviteBtn} activeOpacity={0.85} accessibilityRole="button">
              <IconLabel icon="refresh" color={colors.text} style={styles.inviteBtnText}>{t('community_manage_regenerate')}</IconLabel>
            </TouchableOpacity>
          )}
        </View>
        )}
      </View>

      {/* KATILMA İSTEKLERİ */}
      <Text style={styles.sectionTitle}>
        {tu('community_manage_requests')}{requests.length > 0 ? ` (${requests.length})` : ''}
      </Text>
      {requests.length === 0 ? (
        <Text style={styles.empty}>{t('community_manage_no_requests')}</Text>
      ) : requests.map(r => (
        <View key={r.userId} style={styles.row}>
          <Avatar user={r} styles={styles} />
          <Text style={styles.username} numberOfLines={1}>@{r.username}</Text>
          <TouchableOpacity onPress={() => approve(r.userId)} style={[styles.smallBtn, styles.approveBtn, community?.archived && { opacity: 0.4 }]} disabled={busy || !!community?.archived}>
            <Text style={styles.approveText}>{t('community_manage_approve')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => reject(r.userId)} style={[styles.smallBtn, styles.rejectBtn]} disabled={busy}>
            <Text style={styles.rejectText}>{t('community_manage_reject')}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* ÜYELER */}
      <Text style={styles.sectionTitle}>{tu('community_manage_members')} ({members.length})</Text>
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
                <Text style={styles.rejectText}>{t('community_manage_ban')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}

      {/* YASAKLILAR */}
      <Text style={styles.sectionTitle}>{tu('community_manage_banned')}{bans.length > 0 ? ` (${bans.length})` : ''}</Text>
      {bans.length === 0 ? (
        <Text style={styles.empty}>{t('community_manage_no_banned')}</Text>
      ) : bans.map(b => (
        <View key={b.userId} style={styles.row}>
          <Avatar user={b} styles={styles} />
          <Text style={[styles.username, { flex: 1 }]} numberOfLines={1}>@{b.username}</Text>
          <TouchableOpacity onPress={() => unban(b.userId, b.username)} style={styles.smallBtn} disabled={busy}>
            <Text style={styles.smallBtnText}>{t('community_manage_unban')}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* TOPLULUĞU DÜZENLE (BUG-03: sahip + aktif moderatör; arşivlide yok) */}
      {(isOwner || isModerator) && !community?.archived && (
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateCommunity', { communityId: community.id, mode: 'edit' })}
          style={styles.inviteBtn2}
          activeOpacity={0.85}
          disabled={busy}
          accessibilityRole="button"
        >
          <IconLabel icon="create-outline" color={colors.text} style={styles.inviteBtnText}>{t('community_edit_entry')}</IconLabel>
        </TouchableOpacity>
      )}

      {/* SAHİPLİĞİ DEVRET (yalnız sahip) */}
      {isOwner && !community?.archived && (
        <TouchableOpacity
          onPress={() => navigation.navigate('TransferOwnership', { communityId })}
          style={styles.inviteBtn2}
          activeOpacity={0.85}
          disabled={busy}
          accessibilityRole="button"
        >
          <IconLabel icon="swap-horizontal" color={colors.text} style={styles.inviteBtnText}>{t('community_transfer_entry')}</IconLabel>
        </TouchableOpacity>
      )}

      {/* SİL (yalnız sahip) */}
      {isOwner && (
        <TouchableOpacity onPress={deleteCommunity} style={styles.deleteBtn} activeOpacity={0.85} accessibilityRole="button">
          <IconLabel icon="trash-outline" color={colors.primary} style={styles.deleteText}>{t('community_manage_delete')}</IconLabel>
        </TouchableOpacity>
      )}
      {isModerator && (
        <TouchableOpacity onPress={leaveCommunity} style={styles.deleteBtn} activeOpacity={0.85} disabled={busy} accessibilityRole="button">
          <IconLabel icon="exit-outline" color={colors.primary} style={styles.deleteText}>{t('community_leave')}</IconLabel>
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
      letterSpacing: 1.2,
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
    inviteBtn2: {
      marginHorizontal: 16, marginTop: 24, paddingVertical: 13, borderRadius: 14, alignItems: 'center',
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
