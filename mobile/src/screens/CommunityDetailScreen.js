import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Image, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import { hapticLight } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';
import { communityTypeLabel } from '../utils/communityType';
import API, { getErrorMessage, uploadImage } from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { communityErrorMessage } from '../utils/communityErrors';
import DeepLinkLoader from '../components/DeepLinkLoader';
import { formatRelativeShort } from '../utils/time';

export default function CommunityDetailScreen({ route, navigation }) {
  const { communityId } = route.params;
  const { colors } = useTheme();
  const { t, tu, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const modInFlight = useRef(new Set());

  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLocked, setPostsLocked] = useState(false);
  const [lockedByReview, setLockedByReview] = useState(false);
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [acting, setActing] = useState(false);
  // Yükleme hatası (ağ/5xx): yalnızca 404/geçersiz id "bulunamadı" sayılır (C6)
  const [fetchError, setFetchError] = useState(null);
  // Uçuştaki beğeni / oy istekleri (gönderi başına, B3)
  const likeInFlight = useRef(new Set());
  const voteInFlight = useRef(new Set());
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';

  // Paylaşım kutusu: tip + foto + anket
  const [composerType, setComposerType] = useState('TEXT'); // TEXT | IMAGE | POLL
  const [imageUri, setImageUri] = useState(null);
  const [pollOpts, setPollOpts] = useState(['', '']);

  // Yorumlar (yanıtlar)
  const [expanded, setExpanded] = useState(null);           // açık olan post id
  const [commentsByPost, setCommentsByPost] = useState({}); // postId -> yorum[]
  const [commentDrafts, setCommentDrafts] = useState({});   // postId -> taslak metin
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const status = community?.currentUserStatus;       // ACTIVE | PENDING | INVITED | null
  const joined = status === 'ACTIVE';

  const fetchData = useCallback(async () => {
    // Geçersiz id (ör. /community/abc) için /communities/NaN isteği atma
    if (!/^\d+$/.test(String(communityId ?? ''))) {
      setLoading(false);
      return;
    }
    try {
      const commRes = await API.get(`/communities/${communityId}`);
      setCommunity(commRes.data);
      setFetchError(null);
      try {
        const postsRes = await API.get(`/communities/${communityId}/posts`);
        setPosts(postsRes.data);
        setPostsLocked(false);
        setLockedByReview(false);
      } catch (postsErr) {
        // Public dışı topluluklarda üye olmayan gönderileri göremez;
        // incelemedeki toplulukta dışarıdan okuma 403 COMMUNITY_PENDING_REVIEW verir
        setLockedByReview(postsErr?.response?.data?.message === 'COMMUNITY_PENDING_REVIEW');
        setPostsLocked(true);
        setPosts([]);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 || status === 400) {
        // Bulunamayan topluluk beklenen bir durum: "İçerik bulunamadı" gösterilir
        setCommunity(null);
        setFetchError(null);
      } else {
        // Ağ / sunucu hatası: içerik zaten yüklüyse olduğu gibi kalır, yoksa yeniden dene ekranı
        setFetchError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Görünürlük + üyelik durumuna göre ana buton davranışı
  const handleJoinPress = () => {
    if (acting) return;
    if (community?.archived && !joined) return;
    if (joined) {
      // Ayrılmadan önce onay (C7)
      Alert.alert(t('community_leave'), t(community?.currentUserRole === 'MODERATOR' ? 'community_leave_confirm' : 'community_leave_confirm_member'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('community_leave'), style: 'destructive', onPress: performJoinAction },
      ]);
      return;
    }
    performJoinAction();
  };

  const performJoinAction = async () => {
    if (acting) return;
    // Arşivlenmiş toplulukta yeni katılım / davet kabulü kapalı (üyelik API çağrısı yok)
    if (community?.archived && !joined) return;
    setActing(true);
    try {
      if (joined) {
        await API.delete(`/communities/${communityId}/join`);
        // Gizli topluluktan ayrılan artık erişemez: yeniden çekmek 404 verir
        if (community?.visibility === 'SECRET') {
          goBackOrFallback(navigation);
          return;
        }
        await fetchData();
      } else if (status === 'INVITED') {
        const res = await API.post(`/communities/${communityId}/invite/accept`);
        setCommunity(res.data);
        await fetchData();
      } else {
        const res = await API.post(`/communities/${communityId}/join`);
        setCommunity(res.data);
        if (res.data.currentUserStatus === 'PENDING') {
          Alert.alert(t('success'), t('community_request_sent'));
        } else {
          await fetchData();
        }
      }
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      setActing(false);
    }
  };

  // Ana buton metni / pasifliği
  const joinButton = (() => {
    if (status === 'PENDING') return { label: t('community_request_pending'), disabled: true, active: true };
    if (status === 'INVITED') return { label: t('communities_join'), disabled: false, active: false };
    if (joined) return { label: t('communities_joined'), disabled: false, active: true };
    if (community?.visibility === 'PRIVATE') return { label: t('community_request_join'), disabled: false, active: false };
    return { label: t('communities_join'), disabled: false, active: false };
  })();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('post_perm_title'), t('post_perm_msg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setComposerType('IMAGE');
    }
  };

  const selectType = (type) => {
    setComposerType(type);
    if (type !== 'IMAGE') setImageUri(null);
    if (type === 'POLL' && pollOpts.length < 2) setPollOpts(['', '']);
  };

  const setPollOpt = (txt, i) => setPollOpts(prev => prev.map((o, idx) => idx === i ? txt : o));
  const addPollOpt = () => { if (pollOpts.length < 4) setPollOpts(prev => [...prev, '']); };
  const removePollOpt = (i) => { if (pollOpts.length > 2) setPollOpts(prev => prev.filter((_, idx) => idx !== i)); };

  const resetComposer = () => {
    setDraft(''); setComposerType('TEXT'); setImageUri(null); setPollOpts(['', '']);
  };

  const publishPost = async () => {
    const content = draft.trim();
    if (composerType === 'IMAGE' && !imageUri) { Alert.alert(t('error'), t('post_no_image')); return; }
    if (composerType === 'POLL') {
      const filled = pollOpts.filter(o => o.trim());
      if (filled.length < 2) { Alert.alert(t('error'), t('post_poll_min')); return; }
    }
    if (composerType === 'TEXT' && !content) return;

    setPublishing(true);
    try {
      let serverImageUrl;
      if (composerType === 'IMAGE' && imageUri) {
        serverImageUrl = await uploadImage(imageUri);
      }
      const res = await API.post(`/communities/${communityId}/posts`, {
        content,
        postType: composerType,
        imageUrl: serverImageUrl,
        pollOptions: composerType === 'POLL' ? pollOpts.filter(o => o.trim()) : undefined,
      });
      setPosts(prev => [res.data, ...prev]);
      resetComposer();
      setCommunity(prev => prev ? { ...prev, postCount: prev.postCount + 1 } : prev);
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      setPublishing(false);
    }
  };

  const votePoll = async (post, optionId) => {
    if (voteInFlight.current.has(post.id)) return;
    voteInFlight.current.add(post.id);
    try {
      const res = await API.post(`/communities/${communityId}/posts/${post.id}/poll/vote`, null, { params: { optionId } });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, pollOptions: res.data } : p));
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      voteInFlight.current.delete(post.id);
    }
  };

  const toggleLike = async (post) => {
    if (likeInFlight.current.has(post.id)) return;
    hapticLight();
    likeInFlight.current.add(post.id);
    try {
      if (post.isLikedByCurrentUser) {
        await API.delete(`/communities/${communityId}/posts/${post.id}/like`);
      } else {
        await API.post(`/communities/${communityId}/posts/${post.id}/like`);
      }
      setPosts(prev => prev.map(p =>
        p.id === post.id
          ? {
              ...p,
              likeCount: p.likeCount + (post.isLikedByCurrentUser ? -1 : 1),
              isLikedByCurrentUser: !post.isLikedByCurrentUser,
            }
          : p
      ));
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      likeInFlight.current.delete(post.id);
    }
  };

  const toggleComments = async (post) => {
    if (expanded === post.id) { setExpanded(null); return; }
    setExpanded(post.id);
    if (!commentsByPost[post.id]) {
      setLoadingComments(true);
      try {
        const res = await API.get(`/communities/${communityId}/posts/${post.id}/comments`);
        setCommentsByPost(prev => ({ ...prev, [post.id]: res.data }));
      } catch (err) {
        Alert.alert(t('error'), communityErrorMessage(err, t));
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const setDraftFor = (postId, text) =>
    setCommentDrafts(prev => ({ ...prev, [postId]: text }));

  const sendComment = async (post) => {
    const content = (commentDrafts[post.id] || '').trim();
    if (!content || sendingComment) return;
    setSendingComment(true);
    try {
      const res = await API.post(`/communities/${communityId}/posts/${post.id}/comments`, { content });
      setCommentsByPost(prev => ({ ...prev, [post.id]: [...(prev[post.id] || []), res.data] }));
      setDraftFor(post.id, '');
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      setSendingComment(false);
    }
  };

  // Gönderi / yorum ⋯ menüsü: şikâyet (yazar değilse) + gizle/göster (yönetici) — B11
  const isOwnContent = (item) => !!session?.userId && String(item.userId) === String(session.userId);

  const submitReport = async (targetType, targetId, reason) => {
    const key = `r:${targetType}:${targetId}`;
    if (modInFlight.current.has(key)) return;
    modInFlight.current.add(key);
    try {
      await API.post('/reports', { targetType, targetId, reason });
      Alert.alert(t('mod_reported_title'), t('mod_reported_msg'));
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t, 'mod_error'));
    } finally {
      modInFlight.current.delete(key);
    }
  };

  const askReportReason = (targetType, targetId) => {
    Alert.alert(t('mod_reason_title'), null, [
      { text: t('mod_reason_spam'), onPress: () => submitReport(targetType, targetId, 'SPAM') },
      { text: t('mod_reason_harassment'), onPress: () => submitReport(targetType, targetId, 'HARASSMENT') },
      { text: t('mod_reason_inappropriate'), onPress: () => submitReport(targetType, targetId, 'INAPPROPRIATE') },
      { text: t('mod_cancel'), style: 'cancel' },
    ]);
  };

  const toggleHide = async (post, comment) => {
    const target = comment || post;
    const key = comment ? `hc:${comment.id}` : `hp:${post.id}`;
    if (modInFlight.current.has(key)) return;
    modInFlight.current.add(key);
    const base = `/communities/${communityId}/posts/${post.id}${comment ? `/comments/${comment.id}` : ''}/hide`;
    try {
      if (target.isHidden) await API.delete(base); else await API.post(base);
      const next = !target.isHidden;
      if (comment) {
        setCommentsByPost(prev => ({
          ...prev,
          [post.id]: (prev[post.id] || []).map(c => c.id === comment.id ? { ...c, isHidden: next } : c),
        }));
      } else {
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isHidden: next } : p));
      }
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      modInFlight.current.delete(key);
    }
  };

  const openItemMenu = (post, comment) => {
    const target = comment || post;
    const buttons = [];
    if (!isOwnContent(target)) {
      buttons.push({ text: t('community_item_report'), onPress: () => askReportReason(comment ? 'COMMUNITY_COMMENT' : 'COMMUNITY_POST', target.id) });
    }
    if (community?.canManage) {
      buttons.push({ text: t(target.isHidden ? 'community_item_unhide' : 'community_item_hide'), onPress: () => toggleHide(post, comment) });
    }
    if (buttons.length === 0) return;
    buttons.push({ text: t('mod_cancel'), style: 'cancel' });
    Alert.alert('', null, buttons);
  };

  const canOpenMenu = (item) => !isOwnContent(item) || !!community?.canManage;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!community && fetchError) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingHorizontal: 40 }]}>
        <Ionicons name="cloud-offline-outline" size={46} color={colors.textSecondary} style={{ marginBottom: 12 }} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 }}>{t('load_failed')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 }}>{fetchError}</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); fetchData(); }}
          activeOpacity={0.85}
          style={{ backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 }}
          accessibilityRole="button"
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{t('retry')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '700' }}>{t('back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!community) {
    // Eskiden yalnızca "Topluluk yüklenemedi" yazıyordu; geri dönüş yolu yoktu
    return <DeepLinkLoader error onBack={() => navigation.navigate('MainApp')} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {/* Topluluğu kuranın seçtiği tema renkleri — topluluk kimliği olduğu için gradyan kalır */}
      <LinearGradient
        colors={[community.gradientStart, community.gradientEnd]}
        style={styles.hero}
      >
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <View style={styles.heroTopRow}>
          <View style={styles.heroEmojiCircle}>
            <Text style={styles.heroEmoji}>{community.emoji}</Text>
          </View>
          <View style={styles.heroTitleCol}>
            <Text style={styles.heroTitle} numberOfLines={2}>{community.name}</Text>
            <View style={styles.heroChips}>
              <View style={[styles.heroChip, styles.heroChipRow]}>
                <Ionicons
                  name={community.visibility === 'PRIVATE' ? 'lock-closed'
                    : community.visibility === 'SECRET' ? 'eye-off' : 'globe-outline'}
                  size={11}
                  color="#fff"
                />
                <Text style={styles.heroChipText}>
                  {community.visibility === 'PRIVATE' ? t('community_visibility_private')
                    : community.visibility === 'SECRET' ? t('community_visibility_secret')
                    : t('community_visibility_public')}
                </Text>
              </View>
              {community.archived ? (
                <View style={[styles.heroChip, styles.heroChipRow]}>
                  <Ionicons name="archive-outline" size={11} color="#fff" />
                  <Text style={styles.heroChipText}>{t('community_archived_badge')}</Text>
                </View>
              ) : null}
              {community.approvalStatus === 'PENDING' ? (
                <View style={styles.heroChip}><Text style={styles.heroChipText}>{t('community_pending_badge')}</Text></View>
              ) : null}
              {!!community.type && (
                <View style={[styles.heroChip, styles.heroChipRow]}>
                  <Ionicons name="musical-notes-outline" size={11} color="#fff" />
                  <Text style={styles.heroChipText}>{communityTypeLabel(community.type, t)}</Text>
                </View>
              )}
              {!!community.city && (
                <View style={[styles.heroChip, styles.heroChipRow]}>
                  <Ionicons name="location-outline" size={11} color="#fff" />
                  <Text style={styles.heroChipText}>{community.city}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {!!community.description && (
          <Text style={styles.heroSub}>{community.description}</Text>
        )}

        <View style={styles.heroStats}>
          <Text style={styles.heroStatItem}>
            <Text style={styles.heroStatNumber}>{community.memberCount.toLocaleString(locale)}</Text>
            <Text style={styles.heroStatLabel}>  {t('communities_stat_members')}</Text>
          </Text>
          <Text style={styles.heroStatSep}>•</Text>
          <Text style={styles.heroStatItem}>
            <Text style={styles.heroStatNumber}>{community.postCount}</Text>
            <Text style={styles.heroStatLabel}>  {t('communities_stat_posts')}</Text>
          </Text>
        </View>

        {community.canManage ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('CommunityManage', { communityId })}
            style={[styles.heroJoinButton, styles.heroJoinButtonActive]}
            accessibilityRole="button"
          >
            <Text style={styles.heroJoinTextActive}>
              {t('community_manage')}
              {community.pendingRequestCount > 0 ? ` (${community.pendingRequestCount})` : ''}
            </Text>
          </TouchableOpacity>
        ) : community.archived && !joined ? (
          <Text style={styles.heroArchivedInfo}>{t('community_archived_info')}</Text>
        ) : community.approvalStatus === 'PENDING' && !joined && status !== 'PENDING' ? (
          <Text style={styles.heroArchivedInfo}>{t('community_pending_join_info')}</Text>
        ) : (
          <TouchableOpacity
            onPress={handleJoinPress}
            disabled={joinButton.disabled || acting}
            style={[styles.heroJoinButton, joinButton.active && styles.heroJoinButtonActive, (joinButton.disabled || acting) && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: joinButton.disabled || acting, busy: acting }}
          >
            {acting
              ? <ActivityIndicator color={joinButton.active ? '#fff' : colors.primary} />
              : <Text style={[styles.heroJoinText, joinButton.active && styles.heroJoinTextActive]}>
                  {joinButton.label}
                </Text>}
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* ONAY DURUMU BANNER'I */}
      {community.approvalStatus === 'PENDING' && (
        <View style={[styles.banner, styles.bannerReview]}>
          <View style={styles.bannerRow}>
            <Ionicons name="time-outline" size={16} color="#F5A623" />
            <Text style={[styles.bannerText, styles.bannerTextFlex]}>{t('community_review_banner')}</Text>
          </View>
        </View>
      )}
      {community.approvalStatus === 'REJECTED' && (
        <View style={[styles.banner, styles.bannerRejected]}>
          <View style={styles.bannerRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.bannerText, styles.bannerTextFlex]}>{t('community_rejected_banner')}</Text>
          </View>
        </View>
      )}

      {/* SABİTLENMİŞ KONU */}
      {!!community.nextEvent && (
        <View style={styles.section}>
          <View style={styles.pinnedCard}>
            <View style={[styles.pinnedIcon, { backgroundColor: community.gradientStart || colors.primary }]}>
              <Ionicons name="pin" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinnedLabel}>{tu('communities_next_event')}</Text>
              <Text style={styles.pinnedTitle} numberOfLines={2}>{community.nextEvent}</Text>
            </View>
          </View>
        </View>
      )}

      {/* PAYLAŞIM KUTUSU */}
      {joined && (
        <View style={styles.section}>
          <View style={styles.composer}>
            <View style={styles.composerTop}>
              <View style={styles.composerAvatar}>
                <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
              </View>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('communities_compose')}
                placeholderTextColor={colors.textSecondary}
                maxLength={500}
                multiline
                style={styles.composerInput}
              />
            </View>

            {/* Foto önizleme */}
            {composerType === 'IMAGE' && imageUri && (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity onPress={() => { setImageUri(null); setComposerType('TEXT'); }} style={styles.imageRemove} accessibilityRole="button" accessibilityLabel={t('delete')}>
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Anket seçenekleri */}
            {composerType === 'POLL' && (
              <View style={styles.pollEditor}>
                {pollOpts.map((opt, i) => (
                  <View key={i} style={styles.pollOptRow}>
                    <TextInput
                      value={opt}
                      onChangeText={(txt) => setPollOpt(txt, i)}
                      placeholder={`${t('post_poll_option')} ${i + 1}`}
                      placeholderTextColor={colors.textSecondary}
                      style={styles.pollOptInput}
                      maxLength={60}
                    />
                    {pollOpts.length > 2 && (
                      <TouchableOpacity onPress={() => removePollOpt(i)} style={styles.pollOptRemove} accessibilityRole="button" accessibilityLabel={t('delete')}>
                        <Ionicons name="close" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {pollOpts.length < 4 && (
                  <TouchableOpacity onPress={addPollOpt} style={[styles.pollAddBtn, styles.inlineRow]} accessibilityRole="button">
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={styles.pollAddText}>{t('post_poll_add')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.composerBar}>
              <View style={styles.composerTools}>
                <TouchableOpacity
                  onPress={pickImage}
                  style={[styles.toolBtn, composerType === 'IMAGE' && styles.toolBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={t('post_type_image')}
                  accessibilityState={{ selected: composerType === 'IMAGE' }}
                >
                  <Ionicons name="image-outline" size={20} color={composerType === 'IMAGE' ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => selectType(composerType === 'POLL' ? 'TEXT' : 'POLL')}
                  style={[styles.toolBtn, composerType === 'POLL' && styles.toolBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={t('post_type_poll')}
                  accessibilityState={{ selected: composerType === 'POLL' }}
                >
                  <Ionicons name="stats-chart-outline" size={19} color={composerType === 'POLL' ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={publishPost}
                disabled={publishing}
                activeOpacity={0.9}
                style={[styles.publishButton, publishing && styles.publishButtonDisabled]}
                accessibilityRole="button"
                accessibilityState={{ busy: publishing }}
              >
                {publishing ? (
                  <Text style={styles.publishText}>...</Text>
                ) : (
                  <View style={styles.inlineRow}>
                    <Text style={styles.publishText}>{t('communities_publish')}</Text>
                    <Ionicons name="send" size={13} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>{t('communities_feed')}</Text>
          {!postsLocked && posts.length > 0 && (
            <View style={styles.feedCountPill}>
              <Text style={styles.feedCountText}>{posts.length}</Text>
            </View>
          )}
        </View>
        {postsLocked && (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={36} color={colors.textSecondary} style={styles.lockedEmoji} />
            <Text style={styles.lockedText}>{t(lockedByReview ? 'community_posts_locked_review' : 'community_posts_locked')}</Text>
          </View>
        )}
        {!postsLocked && posts.map(post => {
          const open = expanded === post.id;
          const comments = commentsByPost[post.id] || [];
          return (
            <View key={post.id} style={[styles.postCard, post.isHidden && styles.hiddenItem]}>
              <View style={styles.postHeader}>
                <Avatar uri={post.userProfileImageUrl} name={post.username} styles={styles} />
                <View style={styles.postHeaderText}>
                  <Text style={styles.username}>@{post.username}</Text>
                  <Text style={styles.postTime}>
                    {formatRelativeShort(post.createdAt, lang)}
                    {post.isHidden ? ` · ${t('community_item_hidden')}` : ''}
                  </Text>
                </View>
                {canOpenMenu(post) && (
                  <TouchableOpacity onPress={() => openItemMenu(post)} style={styles.menuBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('mod_options_title')}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {!!post.content && <Text style={styles.postContent}>{post.content}</Text>}

              {post.imageUrl && (
                <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
              )}

              {post.postType === 'POLL' && post.pollOptions && (
                <Poll post={post} onVote={votePoll} styles={styles} colors={colors} t={t} />
              )}

              <View style={styles.postFooter}>
                <TouchableOpacity
                  onPress={() => toggleLike(post)}
                  style={styles.actionBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!post.isLikedByCurrentUser }}
                  accessibilityLabel={`${t('a11y_like')}, ${post.likeCount}`}
                >
                  <Ionicons
                    name={post.isLikedByCurrentUser ? 'heart' : 'heart-outline'}
                    size={17}
                    color={post.isLikedByCurrentUser ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.actionLabel, post.isLikedByCurrentUser && styles.actionLabelLiked]}>
                    {post.likeCount}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleComments(post)}
                  style={styles.actionBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={open ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.actionLabel, open && styles.actionLabelActive]}>
                    {post.commentCount || 0} {t('communities_reply')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* YORUMLAR */}
              {open && (
                <View style={styles.commentsWrap}>
                  {loadingComments && !commentsByPost[post.id] ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
                  ) : (
                    <>
                      {comments.map(c => (
                        <View key={c.id} style={[styles.commentRow, c.isHidden && styles.hiddenItem]}>
                          <Avatar uri={c.userProfileImageUrl} name={c.username} styles={styles} small />
                          <View style={styles.commentBubble}>
                            <Text style={styles.commentUser}>
                              @{c.username}{c.isHidden ? ` · ${t('community_item_hidden')}` : ''}
                            </Text>
                            <Text style={styles.commentText}>{c.content}</Text>
                          </View>
                          {canOpenMenu(c) && (
                            <TouchableOpacity onPress={() => openItemMenu(post, c)} style={styles.menuBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('mod_options_title')}>
                              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                      {comments.length === 0 && (
                        <Text style={styles.commentEmpty}>{t('communities_no_comments')}</Text>
                      )}
                    </>
                  )}

                  {joined && (
                    <View style={styles.commentComposer}>
                      <TextInput
                        value={commentDrafts[post.id] || ''}
                        onChangeText={(txt) => setDraftFor(post.id, txt)}
                        placeholder={t('communities_reply_ph')}
                        placeholderTextColor={colors.textSecondary}
                        style={styles.commentInput}
                        maxLength={300}
                        multiline
                      />
                      <TouchableOpacity
                        onPress={() => sendComment(post)}
                        disabled={!(commentDrafts[post.id] || '').trim() || sendingComment}
                        style={[styles.commentSend, (!(commentDrafts[post.id] || '').trim() || sendingComment) && { opacity: 0.4 }]}
                        accessibilityRole="button"
                        accessibilityLabel={t('send')}
                      >
                        <Ionicons name="send" size={15} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
        {!postsLocked && posts.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="chatbubbles-outline" size={42} color={colors.textSecondary} style={styles.emptyEmoji} />
            <Text style={styles.emptyTitle}>{t('communities_empty')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Poll({ post, onVote, styles, colors, t }) {
  const options = post.pollOptions || [];
  const total = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);
  const hasVoted = options.some(o => o.voted);
  return (
    <View style={styles.pollWrap}>
      {options.map(o => {
        const pct = total > 0 ? Math.round((o.voteCount / total) * 100) : 0;
        return (
          <TouchableOpacity
            key={o.id}
            activeOpacity={0.85}
            onPress={() => onVote(post, o.id)}
            style={[styles.pollBar, o.voted && styles.pollBarVoted]}
          >
            {hasVoted && <View style={[styles.pollFill, { width: `${pct}%` }, o.voted && styles.pollFillVoted]} />}
            <View style={styles.pollBarContent}>
              {o.voted && <Ionicons name="checkmark" size={15} color={colors.primary} style={{ marginRight: 4 }} />}
              <Text style={[styles.pollOptText, o.voted && styles.pollOptTextVoted]} numberOfLines={1}>
                {o.optionText}
              </Text>
              {hasVoted && <Text style={styles.pollPct}>{pct}%</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.pollTotal}>{t('post_poll_votes', { n: total })}</Text>
    </View>
  );
}

function Avatar({ uri, name, styles, small }) {
  const st = small ? styles.avatarSmall : styles.avatar;
  if (uri) return <Image source={{ uri }} style={st} />;
  return (
    <View style={st}>
      <Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 32 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: colors.textSecondary, fontSize: 14 },
    banner: { marginHorizontal: 16, marginTop: 14, borderRadius: 12, padding: 12, borderWidth: 1 },
    bannerReview: { backgroundColor: '#F5A62318', borderColor: '#F5A623' },
    bannerRejected: { backgroundColor: '#E9456018', borderColor: '#E94560' },
    bannerText: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
    bannerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bannerTextFlex: { flex: 1 },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    hero: {
      paddingTop: 54,
      paddingBottom: 22,
      paddingHorizontal: 20,
    },
    backButton: { alignSelf: 'flex-start', marginBottom: 16 },
    backText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    heroEmojiCircle: {
      width: 64, height: 64, borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroEmoji: { fontSize: 32 },
    heroTitleCol: { flex: 1 },
    heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 27 },
    heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    heroChip: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4,
    },
    heroChipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    heroChipText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    heroSub: {
      color: 'rgba(255,255,255,0.92)',
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: 14,
    },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      gap: 12,
    },
    heroStatItem: { color: '#fff' },
    heroStatNumber: { color: '#fff', fontSize: 16, fontWeight: '900' },
    heroStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: '600' },
    heroStatSep: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
    heroJoinButton: {
      marginTop: 18,
      backgroundColor: '#fff',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    heroJoinButtonActive: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    heroJoinText: { color: '#1a1a1a', fontSize: 15, fontWeight: '900' },
    heroJoinTextActive: { color: '#fff', fontSize: 15, fontWeight: '900' },
    heroArchivedInfo: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 12, opacity: 0.9 },
    section: { paddingHorizontal: 16, marginTop: 18 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },

    // SABİTLENMİŞ KONU
    pinnedCard: {
      flexDirection: 'row', alignItems: 'center', gap: 13,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 18, padding: 14,
    },
    pinnedIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    pinnedLabel: {
      color: colors.textSecondary, fontSize: 11, fontWeight: '800',
      letterSpacing: 0.8, marginBottom: 3,
    },
    pinnedTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },

    // PAYLAŞIM KUTUSU
    composer: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 14,
    },
    composerTop: { flexDirection: 'row', gap: 11 },
    composerAvatar: {
      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    composerInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 140,
      color: colors.text,
      fontSize: 14.5,
      lineHeight: 20,
      textAlignVertical: 'top',
      paddingTop: 8,
    },
    composerBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 12,
    },
    composerTools: { flexDirection: 'row', gap: 8 },
    toolBtn: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    toolBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
    publishButton: {
      backgroundColor: colors.primary,
      borderRadius: 22,
      paddingVertical: 11,
      paddingHorizontal: 22,
    },
    publishButtonDisabled: { opacity: 0.4 },
    publishText: { color: '#fff', fontSize: 13, fontWeight: '900' },

    // FOTO ÖNİZLEME (composer)
    imagePreviewWrap: { marginTop: 12, position: 'relative' },
    imagePreview: { width: '100%', height: 180, borderRadius: 14, backgroundColor: colors.cardAlt },
    imageRemove: {
      position: 'absolute', top: 8, right: 8,
      width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center', justifyContent: 'center',
    },

    // ANKET EDİTÖRÜ (composer)
    pollEditor: { marginTop: 12, gap: 8 },
    pollOptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pollOptInput: {
      flex: 1, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, color: colors.text, fontSize: 14,
    },
    pollOptRemove: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
    pollAddBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
    pollAddText: { color: colors.primary, fontSize: 13, fontWeight: '800' },

    // GÖNDERİ FOTO + ANKET (kart)
    postImage: { width: '100%', height: 220, borderRadius: 14, marginTop: 12, backgroundColor: colors.cardAlt },
    pollWrap: { marginTop: 12, gap: 8 },
    pollBar: {
      position: 'relative', overflow: 'hidden',
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.cardAlt, minHeight: 42, justifyContent: 'center',
    },
    pollBarVoted: { borderColor: colors.primary },
    pollFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary + '26' },
    pollFillVoted: { backgroundColor: colors.primary + '40' },
    pollBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
    pollOptText: { color: colors.text, fontSize: 13.5, fontWeight: '700', flex: 1 },
    pollOptTextVoted: { color: colors.primary, fontWeight: '900' },
    pollPct: { color: colors.text, fontSize: 13, fontWeight: '900', marginLeft: 10 },
    pollTotal: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '600', marginTop: 2 },

    // FEED BAŞLIĞI
    feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    feedTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
    feedCountPill: {
      backgroundColor: colors.primary, borderRadius: 11,
      minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center',
    },
    feedCountText: { color: '#fff', fontSize: 12, fontWeight: '900' },

    // KİLİTLİ / BOŞ DURUM
    lockedCard: {
      alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 18, paddingVertical: 32, paddingHorizontal: 24,
    },
    lockedEmoji: { marginBottom: 10 },
    lockedText: { color: colors.textSecondary, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
    emptyCard: { alignItems: 'center', paddingVertical: 36 },
    emptyEmoji: { marginBottom: 12, opacity: 0.85 },
    emptyTitle: { color: colors.textSecondary, fontSize: 13.5, textAlign: 'center', lineHeight: 20, paddingHorizontal: 30 },
    postCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
    },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    avatarSmall: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    avatarText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
    postHeaderText: { flex: 1 },
    hiddenItem: { opacity: 0.5 },
    menuBtn: { paddingHorizontal: 8, paddingVertical: 2 },
    username: { color: colors.text, fontSize: 14, fontWeight: '800' },
    postTime: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    postContent: { color: colors.text, fontSize: 14.5, lineHeight: 21 },

    postFooter: {
      flexDirection: 'row', gap: 10, marginTop: 14,
      paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
    },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
      backgroundColor: colors.cardAlt,
    },
    actionLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    actionLabelLiked: { color: '#E94560' },
    actionLabelActive: { color: colors.primary },

    // YORUMLAR
    commentsWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
    commentRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
    commentBubble: {
      flex: 1, backgroundColor: colors.cardAlt,
      borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9,
    },
    commentUser: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 2 },
    commentText: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
    commentEmpty: { color: colors.textSecondary, fontSize: 12.5, fontStyle: 'italic', paddingVertical: 4 },
    commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 2 },
    commentInput: {
      flex: 1, backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border, borderRadius: 16,
      paddingHorizontal: 14, paddingVertical: 9,
      color: colors.text, fontSize: 13.5, maxHeight: 100,
    },
    commentSend: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },

    emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 20 },
  });
}
