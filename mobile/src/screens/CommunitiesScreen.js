import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API, { getErrorMessage } from '../services/api';

// key: i18n key, apiValue: backend'e gönderilecek değer (null = hepsi)
const FILTERS = [
  { key: 'all',        labelKey: 'community_filter_all',        apiValue: null },
  { key: 'Rock',       labelKey: 'community_filter_rock',       apiValue: 'Rock' },
  { key: 'Festival',   labelKey: 'community_filter_festival',   apiValue: 'Festival' },
  { key: 'Elektronik', labelKey: 'community_filter_electronic', apiValue: 'Elektronik' },
  { key: 'Şehir',      labelKey: 'community_filter_city',       apiValue: 'Şehir' },
  { key: 'Caz',        labelKey: 'community_filter_jazz',       apiValue: 'Caz' },
];

export default function CommunitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t } = useLanguage();
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

  const fetchCommunities = useCallback(async (type, q) => {
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
      setCommunities(res.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when filters change
  useFocusEffect(
    useCallback(() => {
      fetchCommunities(activeFilter, query);
    }, [activeFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Debounced search
  useEffect(() => {
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
      Alert.alert(t('error'), getErrorMessage(err));
    } finally {
      setJoiningCode(false);
    }
  };

  const toggleJoin = async (community) => {
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
      Alert.alert(t('error'), getErrorMessage(err));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Concertly</Text>
        <Text style={styles.headerTitle}>{t('communities_title')}</Text>
        <Text style={styles.headerSub}>
          {t('communities_search')}
        </Text>

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
      </LinearGradient>

      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('CreateCommunity')}
      >
        <Text style={styles.createBtnText}>{t('community_create_btn')}</Text>
      </TouchableOpacity>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('communities_search')}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Davet koduyla katıl */}
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
        <TouchableOpacity onPress={() => setShowCode(true)} style={styles.codeLink}>
          <Text style={styles.codeLinkText}>🔑 {t('community_join_by_code')}</Text>
        </TouchableOpacity>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.key}
            onPress={() => setActiveFilter(filter.key)}
            style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, activeFilter === filter.key && styles.filterTextActive]}>
              {t(filter.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (error && communities.length === 0) ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorEmoji}>📡</Text>
          <Text style={[styles.errorTitle, { color: colors.text }]}>{t('load_failed')}</Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity onPress={() => fetchCommunities(activeFilter, query)} style={styles.retryBtn} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {communities.map((community) => (
            <TouchableOpacity
              key={community.id}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('CommunityDetail', { communityId: community.id })}
              style={styles.communityCard}
            >
              <LinearGradient
                colors={[community.gradientStart, community.gradientEnd]}
                style={styles.communityArt}
              >
                <Text style={styles.communityEmoji}>{community.emoji}</Text>
                {community.approvalStatus === 'PENDING' ? (
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewText}>{t('community_pending_badge')}</Text>
                  </View>
                ) : community.live && (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveText}>{t('communities_live')}</Text>
                  </View>
                )}
              </LinearGradient>

              <View style={styles.communityBody}>
                <View style={styles.communityTop}>
                  <View style={styles.communityTitleArea}>
                    <Text style={styles.communityName} numberOfLines={1}>
                      {community.visibility === 'PRIVATE' ? '🔒 ' : community.visibility === 'SECRET' ? '🕵️ ' : ''}{community.name}
                    </Text>
                    <Text style={styles.communityMeta}>{community.city} · {community.type}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleJoin(community)}
                    disabled={community.currentUserStatus === 'PENDING'}
                    style={[styles.joinButton, (community.isJoinedByCurrentUser || community.currentUserStatus === 'PENDING') && styles.joinButtonActive]}
                  >
                    <Text style={[styles.joinText, (community.isJoinedByCurrentUser || community.currentUserStatus === 'PENDING') && styles.joinTextActive]}>
                      {community.currentUserStatus === 'PENDING'
                        ? t('community_request_pending')
                        : community.isJoinedByCurrentUser
                          ? t('communities_joined')
                          : t('communities_join')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.communityDescription} numberOfLines={2}>
                  {community.description}
                </Text>

                <View style={styles.communityFooter}>
                  <Text style={styles.footerMetric}>{community.memberCount.toLocaleString('tr-TR')} {t('communities_members')}</Text>
                  <Text style={styles.footerMetric}>{community.postCount} {t('communities_posts')}</Text>
                  <Text style={styles.footerMetric}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 32 },
    header: { paddingTop: 56, paddingBottom: 22, paddingHorizontal: 20 },
    backButton: { alignSelf: 'flex-start', marginBottom: 18 },
    backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    headerLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
    headerTitle: { color: colors.text, fontSize: 31, fontWeight: 'bold', marginBottom: 8 },
    headerSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    statPill: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    statNumber: { color: colors.text, fontSize: 17, fontWeight: 'bold' },
    statLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    searchIcon: { color: colors.textSecondary, fontSize: 17 },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    createBtn: {
      marginHorizontal: 16, marginTop: 16,
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 13, alignItems: 'center',
    },
    createBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
    codeLink: { marginHorizontal: 16, marginTop: 10, alignSelf: 'flex-start' },
    codeLinkText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    codeBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginHorizontal: 16, marginTop: 10,
    },
    codeInput: {
      flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      color: colors.text, fontSize: 14, letterSpacing: 2,
    },
    codeBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
    codeBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    reviewBadge: {
      position: 'absolute', top: 10, left: 10,
      backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 9,
      paddingHorizontal: 7, paddingVertical: 3,
    },
    reviewText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    filters: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    filterTextActive: { color: '#fff' },
    loadingContainer: { paddingVertical: 60, alignItems: 'center' },
    errorBox: { paddingVertical: 60, paddingHorizontal: 40, alignItems: 'center' },
    errorEmoji: { fontSize: 48, marginBottom: 12 },
    errorTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    errorSub: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
    retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
    retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    list: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
    communityCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      overflow: 'hidden',
    },
    communityArt: {
      width: 96,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    communityEmoji: { fontSize: 34 },
    liveBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: 9,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    liveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    communityBody: { flex: 1, padding: 14 },
    communityTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    communityTitleArea: { flex: 1 },
    communityName: { color: colors.text, fontSize: 15, fontWeight: '800' },
    communityMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
    joinButton: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    joinButtonActive: {
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    joinText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    joinTextActive: { color: colors.primary },
    communityDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 9 },
    communityFooter: { flexDirection: 'row', gap: 12, marginTop: 11, alignItems: 'center' },
    footerMetric: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  });
}
