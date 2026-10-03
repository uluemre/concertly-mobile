import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { ListSkeletonPage } from '../components/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { communityTypeLabel } from '../utils/communityType';
import API, { getErrorMessage } from '../services/api';
import { communityErrorMessage } from '../utils/communityErrors';
import { goBackOrFallback } from '../navigation/navHelpers';

// key: i18n key, apiValue: backend'e gönderilecek değer (null = hepsi), emoji: chip görseli
const FILTERS = [
  { key: 'all',        labelKey: 'community_filter_all',        apiValue: null },
  { key: 'Rock',       labelKey: 'community_filter_rock',       apiValue: 'Rock' },
  { key: 'Festival',   labelKey: 'community_filter_festival',   apiValue: 'Festival' },
  { key: 'Elektronik', labelKey: 'community_filter_electronic', apiValue: 'Elektronik' },
  { key: 'Şehir',      labelKey: 'community_filter_city',       apiValue: 'Şehir' },
  { key: 'Caz',        labelKey: 'community_filter_jazz',       apiValue: 'Caz' },
  { key: 'Pop',        labelKey: 'community_filter_pop',        apiValue: 'Pop' },
  { key: 'Rap',        labelKey: 'community_filter_rap',        apiValue: 'Rap' },
  { key: 'Diğer',      labelKey: 'community_filter_other',      apiValue: 'Diğer' },
];

export default function CommunitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t, tu, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const debounceRef = useRef(null);
  // Yalnızca en son isteğin cevabı ekrana yazılır (N-52 deseni, B2)
  const fetchSeq = useRef(0);
  // Odağa dönüşte güncel arama metni kullanılsın (useFocusEffect eski closure'u tutar)
  const queryRef = useRef('');
  queryRef.current = query;
  // İlk açılışta odak isteği zaten gidiyor; debounce'un ikinci istek atmasını engeller
  const skipFirstDebounce = useRef(true);
  // Uçuştaki katılma/ayrılma istekleri (topluluk id'si başına, B3)
  const joinInFlight = useRef(new Set());
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';

  const fetchCommunities = useCallback(async (type, q) => {
    const seq = ++fetchSeq.current;
    try {
      setLoading(true);
      const favGenres = session.favoriteGenres;
      const filterDef = FILTERS.find(f => f.key === type);
      const apiValue = filterDef?.apiValue ?? null;
      const hasFilters = apiValue || (q && q.trim());

      let res;
      if (favGenres && !hasFilters) {
        // Use personalized recommendations when no filters active
        res = await API.get(`/communities/recommended?genres=${encodeURIComponent(favGenres)}`);
      } else {
        const params = {};
        if (apiValue) params.type = apiValue;
        if (q && q.trim()) params.q = q.trim();
        res = await API.get('/communities', { params });
      }
      if (seq !== fetchSeq.current) return;
      setCommunities(res.data);
      setError(null);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      setError(getErrorMessage(err));
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, []);

  // Fetch on mount and when filters change
  useFocusEffect(
    useCallback(() => {
      fetchCommunities(activeFilter, queryRef.current);
    }, [activeFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Debounced search
  useEffect(() => {
    if (skipFirstDebounce.current) { skipFirstDebounce.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCommunities(activeFilter, query);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const joinedCount = communities.filter(c => c.isJoinedByCurrentUser).length;

  const joinByCode = async () => {
    const trimmed = code.trim();
    if (!trimmed || joiningCode) return;
    setJoiningCode(true);
    try {
      const res = await API.post('/communities/join', null, { params: { code: trimmed } });
      setCode('');
      setShowCode(false);
      navigation.navigate('CommunityDetail', { communityId: res.data.id });
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      setJoiningCode(false);
    }
  };

  const toggleJoin = (community) => {
    // Sahip topluluktan ayrılamaz (sunucu 400 döner); listeden asla ayrılma isteği gitmez (A5)
    if (community.currentUserRole === 'OWNER') return;
    if (joinInFlight.current.has(community.id)) return;
    // Arşivlenmiş toplulukta yeni katılım kapalı: üye olmayan için API çağrısı yok
    if (community.archived && !community.isJoinedByCurrentUser) return;
    if (community.isJoinedByCurrentUser) {
      // Ayrılmadan önce onay (C7)
      Alert.alert(
        t('community_leave'),
        t(community.currentUserRole === 'MODERATOR' ? 'community_leave_confirm' : 'community_leave_confirm_member'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('community_leave'), style: 'destructive', onPress: () => runJoin(community) },
        ]
      );
      return;
    }
    runJoin(community);
  };

  const runJoin = async (community) => {
    if (joinInFlight.current.has(community.id)) return;
    joinInFlight.current.add(community.id);
    try {
      if (community.isJoinedByCurrentUser) {
        await API.delete(`/communities/${community.id}/join`);
        setCommunities(prev => prev.map(c =>
          c.id === community.id
            ? { ...c, isJoinedByCurrentUser: false, currentUserStatus: null, memberCount: Math.max(0, c.memberCount - 1) }
            : c
        ));
      } else {
        // Sunucu görünürlüğe göre ACTIVE/PENDING döner — yanıtı doğrudan kullan
        const res = await API.post(`/communities/${community.id}/join`);
        setCommunities(prev => prev.map(c => c.id === community.id ? res.data : c));
        if (res.data.currentUserStatus === 'PENDING') {
          Alert.alert(t('success'), t('community_request_sent'));
        }
      }
    } catch (err) {
      Alert.alert(t('error'), communityErrorMessage(err, t));
    } finally {
      joinInFlight.current.delete(community.id);
    }
  };

  const renderJoinButton = (community) => {
    // Sahip "Katıldın" yerine detaydaki gibi "Yönet" görür ve yönetim ekranına gider (A5)
    if (community.currentUserRole === 'OWNER') {
      return (
        <TouchableOpacity
          onPress={() => navigation.navigate('CommunityManage', { communityId: community.id })}
          activeOpacity={0.85}
          style={[styles.joinButton, styles.joinButtonActive]}
        >
          <Text style={[styles.joinText, styles.joinTextActive]}>{t('community_manage')}</Text>
        </TouchableOpacity>
      );
    }
    if (community.archived && !community.isJoinedByCurrentUser) {
      return <Text style={styles.archivedInfo}>{t('community_archived_info')}</Text>;
    }
    const pending = community.currentUserStatus === 'PENDING';
    const joined = community.isJoinedByCurrentUser;
    // İncelemedeki toplulukta üye olmayana katılım kapalı (B5)
    if (community.approvalStatus === 'PENDING' && !joined && !pending) {
      return <Text style={styles.archivedInfo}>{t('community_pending_join_info')}</Text>;
    }
    const active = joined || pending;
    return (
      <TouchableOpacity
        onPress={() => toggleJoin(community)}
        disabled={pending}
        activeOpacity={0.85}
        style={[styles.joinButton, active && styles.joinButtonActive, styles.joinRow]}
        accessibilityRole="button"
        accessibilityState={{ selected: joined, disabled: pending }}
      >
        {pending ? <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          : joined ? <Ionicons name="checkmark" size={14} color={colors.textSecondary} /> : null}
        <Text style={[styles.joinText, active && styles.joinTextActive]}>
          {pending ? t('community_request_pending') : joined ? t('communities_joined') : t('communities_join')}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>CONCERTLY</Text>
        <Text style={styles.headerTitle}>{t('communities_title')}</Text>
        <Text style={styles.headerSub}>{t('communities_header_sub')}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{communities.length}</Text>
            <Text style={styles.statLabel}>{t('communities_stat_total')}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{joinedCount}</Text>
            <Text style={styles.statLabel}>{t('communities_stat_joined')}</Text>
          </View>
        </View>
      </View>

      {/* KUR BUTONU */}
      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('CreateCommunity')}
        accessibilityRole="button"
      >
        <View style={styles.createBtnGrad}>
          <View style={styles.createIconCircle}><Ionicons name="add" size={18} color="#fff" /></View>
          <Text style={styles.createBtnText}>{t('community_create_title')}</Text>
        </View>
      </TouchableOpacity>

      {/* ARAMA */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('communities_search')}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* DAVET KODU */}
      {showCode ? (
        <View style={styles.codeBox}>
          <TextInput
            style={styles.codeInput}
            placeholder={t('community_join_code_ph')}
            placeholderTextColor={colors.textSecondary}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={joinByCode} disabled={!code.trim() || joiningCode} style={[styles.codeBtn, (!code.trim() || joiningCode) && { opacity: 0.5 }]}>
            <Text style={styles.codeBtnText}>{joiningCode ? '...' : t('community_join_code_btn')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setShowCode(true)} style={[styles.codeLink, styles.joinRow]} activeOpacity={0.7} accessibilityRole="button">
          <Ionicons name="key-outline" size={14} color={colors.primary} />
          <Text style={styles.codeLinkText}>{t('community_join_by_code')}</Text>
        </TouchableOpacity>
      )}

      {/* FİLTRELER */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map(filter => {
          const on = activeFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.8}
              style={[styles.filterChip, on && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.filterText, on && styles.filterTextActive]}>{t(filter.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionTitle}>{tu('communities_discover')}</Text>

      {loading ? (
        <ListSkeletonPage rows={5} avatar="square" />
      ) : (error && communities.length === 0) ? (
        <View style={styles.errorBox}>
          <Ionicons name="cloud-offline-outline" size={46} color={colors.textSecondary} style={styles.errorEmoji} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>{t('load_failed')}</Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity onPress={() => fetchCommunities(activeFilter, query)} style={styles.retryBtn} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : communities.length === 0 ? (
        <View style={styles.errorBox}>
          <Ionicons name="people-outline" size={46} color={colors.textSecondary} style={styles.errorEmoji} />
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>{t('communities_empty_list')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {communities.map((community) => {
            const visIcon = community.visibility === 'PRIVATE' ? 'lock-closed' : community.visibility === 'SECRET' ? 'eye-off' : null;
            const pending = community.approvalStatus === 'PENDING';
            return (
              <TouchableOpacity
                key={community.id}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('CommunityDetail', { communityId: community.id })}
                style={styles.card}
              >
                {/* topluluğun kendi renginde üst şerit (düz) */}
                <View style={[styles.cardStripe, { backgroundColor: community.gradientStart || colors.primary }]} />

                <View style={styles.cardTop}>
                  {/* Topluluk logosu: kurucunun seçtiği emoji + renkler (kimlik, kalır) */}
                  <LinearGradient
                    colors={[community.gradientStart || '#7C3AED', community.gradientEnd || '#E94560']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarEmoji}>{community.emoji}</Text>
                  </LinearGradient>

                  <View style={styles.cardInfo}>
                    <View style={styles.cardNameRow}>
                      {visIcon ? <Ionicons name={visIcon} size={13} color={colors.textSecondary} /> : null}
                      <Text style={[styles.cardName, styles.cardNameText]} numberOfLines={1}>{community.name}</Text>
                    </View>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {community.city ? `${community.city} · ` : ''}{communityTypeLabel(community.type, t)}
                    </Text>
                    {community.archived ? (
                      <Text style={styles.archivedBadge}>{t('community_archived_badge')}</Text>
                    ) : null}
                    <View style={styles.tagRow}>
                      {pending ? (
                        <View style={[styles.statusChip, styles.statusReview]}>
                          <Text style={styles.statusReviewText}>{t('community_pending_badge')}</Text>
                        </View>
                      ) : community.live ? (
                        <View style={[styles.statusChip, styles.statusLive]}>
                          <Text style={styles.statusLiveText}>● {t('communities_live')}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {!!community.description && (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {community.description}
                  </Text>
                )}

                <View style={styles.cardFooter}>
                  <View style={styles.metrics}>
                    <View style={styles.metricItem}>
                      <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.metric}>{community.memberCount.toLocaleString(locale)}</Text>
                    </View>
                    <Text style={styles.metricDot}>·</Text>
                    <View style={styles.metricItem}>
                      <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.metric}>{community.postCount}</Text>
                    </View>
                  </View>
                  {renderJoinButton(community)}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 36 },

    // HEADER
    header: { paddingTop: 56, paddingBottom: 26, paddingHorizontal: 20 },
    backButton: { alignSelf: 'flex-start', marginBottom: 16 },
    backText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
    headerLabel: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
    headerTitle: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
    headerSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, maxWidth: '92%' },
    statsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
    statPill: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    statNumber: { color: colors.text, fontSize: 22, fontWeight: '900' },
    statLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2, fontWeight: '600' },

    // CREATE
    createBtn: { marginHorizontal: 16, marginTop: 18, borderRadius: 16, overflow: 'hidden' },
    createBtnGrad: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15,
      backgroundColor: colors.primary,
    },
    createIconCircle: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
    },
    createBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

    // SEARCH
    searchBox: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: 16, marginTop: 14,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },

    // CODE
    codeLink: { marginHorizontal: 18, marginTop: 12, alignSelf: 'flex-start' },
    codeLinkText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    codeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12 },
    codeInput: {
      flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
      color: colors.text, fontSize: 14, letterSpacing: 3, fontWeight: '700',
    },
    codeBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
    codeBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

    // FILTERS
    filters: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 2, gap: 8 },
    filterChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
    filterTextActive: { color: '#fff' },

    sectionTitle: {
      color: colors.textSecondary, fontSize: 12, fontWeight: '800',
      letterSpacing: 1.2,
      marginHorizontal: 20, marginTop: 22, marginBottom: 2,
    },

    // STATES
    loadingContainer: { paddingVertical: 60, alignItems: 'center' },
    errorBox: { paddingVertical: 50, paddingHorizontal: 40, alignItems: 'center' },
    errorEmoji: { marginBottom: 12 },
    errorTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    errorSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
    retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
    retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    // LIST + CARD
    list: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 20, padding: 16, paddingTop: 18,
      overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12, shadowRadius: 12, elevation: 3,
    },
    cardStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    avatar: {
      width: 56, height: 56, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarEmoji: { fontSize: 28 },
    cardInfo: { flex: 1 },
    cardName: { color: colors.text, fontSize: 16, fontWeight: '900' },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    cardNameText: { flexShrink: 1 },
    cardMeta: { color: colors.textSecondary, fontSize: 12.5, marginTop: 3, fontWeight: '600' },
    tagRow: { flexDirection: 'row', marginTop: 7 },
    statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    statusReview: { backgroundColor: '#F5A62322', borderWidth: 1, borderColor: '#F5A62355' },
    statusReviewText: { color: '#F5A623', fontSize: 10, fontWeight: '800' },
    statusLive: { backgroundColor: '#00D4AA22', borderWidth: 1, borderColor: '#00D4AA55' },
    statusLiveText: { color: '#00D4AA', fontSize: 10, fontWeight: '800' },

    cardDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 13 },

    cardFooter: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border,
    },
    metrics: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    metricItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metric: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
    metricDot: { color: colors.textSecondary, fontSize: 14 },
    joinButton: {
      paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22,
      backgroundColor: colors.primary,
    },
    joinButtonActive: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
    joinRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    joinText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    joinTextActive: { color: colors.textSecondary },
    archivedBadge: {
      alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
      overflow: 'hidden', backgroundColor: colors.border, color: colors.textSecondary, fontSize: 11, fontWeight: '800',
    },
    archivedInfo: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  });
}
