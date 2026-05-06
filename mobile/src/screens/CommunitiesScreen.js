import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';

export const communities = [
  {
    id: 'istanbul-rock',
    name: 'Istanbul Rock Sahnesi',
    type: 'Rock',
    city: 'Istanbul',
    emoji: '🎸',
    members: 1840,
    posts: 128,
    live: true,
    gradient: ['#E94560', '#7C3AED'],
    description: 'Rock konserleri, mekan önerileri ve konser sonrası yorumlar.',
    nextEvent: 'Dorock XL buluşması',
    tags: ['Rock', 'Metal', 'Istanbul'],
  },
  {
    id: 'festivalciler',
    name: 'Festivalciler',
    type: 'Festival',
    city: 'Turkiye',
    emoji: '🎪',
    members: 3120,
    posts: 246,
    live: true,
    gradient: ['#F5A623', '#E94560'],
    description: 'Festival planları, kamp tavsiyeleri ve line-up sohbetleri.',
    nextEvent: 'Yaz festivali hazırlıkları',
    tags: ['Festival', 'Kamp', 'Line-up'],
  },
  {
    id: 'elektronik-gece',
    name: 'Elektronik Gece',
    type: 'Elektronik',
    city: 'Istanbul',
    emoji: '🎧',
    members: 2210,
    posts: 176,
    live: false,
    gradient: ['#00D4AA', '#0066FF'],
    description: 'DJ setleri, after party duyuruları ve elektronik müzik kültürleri.',
    nextEvent: 'Gece setleri listesi',
    tags: ['DJ', 'Techno', 'House'],
  },
  {
    id: 'ankara-konser',
    name: 'Ankara Konser Grubu',
    type: 'Şehir',
    city: 'Ankara',
    emoji: '📍',
    members: 940,
    posts: 64,
    live: false,
    gradient: ['#7C3AED', '#E94560'],
    description: 'Ankara konserleri, bilet paylaşımları ve etkinlik öncesi buluşmalar.',
    nextEvent: 'Haftanin Ankara konserleri',
    tags: ['Ankara', 'Bulusma', 'Konser'],
  },
  {
    id: 'caz-severler',
    name: 'Caz Severler',
    type: 'Caz',
    city: 'Turkiye',
    emoji: '🎷',
    members: 780,
    posts: 52,
    live: false,
    gradient: ['#16213E', '#F5A623'],
    description: 'Caz kulübü önerileri, konser notları ve sakin performanslar.',
    nextEvent: 'Caz kulübü rotası',
    tags: ['Caz', 'Akustik', 'Kulup'],
  },
];

const filters = ['Tümü', 'Rock', 'Festival', 'Elektronik', 'Şehir', 'Caz'];

function getJoinedCommunities() {
  if (!global.joinedCommunities) {
    global.joinedCommunities = {};
  }
  return global.joinedCommunities;
}

export default function CommunitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [query, setQuery] = useState('');
  const [, setJoinedVersion] = useState(0);

  const joinedCommunities = getJoinedCommunities();

  useFocusEffect(
    useCallback(() => {
      setJoinedVersion(prev => prev + 1);
    }, [])
  );

  const filteredCommunities = communities.filter((community) => {
    const matchesFilter = activeFilter === 'Tümü' || community.type === activeFilter;
    const search = query.trim().toLowerCase();
    const matchesSearch = !search ||
      community.name.toLowerCase().includes(search) ||
      community.city.toLowerCase().includes(search) ||
      community.tags.some(tag => tag.toLowerCase().includes(search));
    return matchesFilter && matchesSearch;
  });

  const joinedCount = communities.filter(item => joinedCommunities[item.id]).length;

  const toggleJoin = (communityId) => {
    joinedCommunities[communityId] = !joinedCommunities[communityId];
    setJoinedVersion(prev => prev + 1);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerLabel}>Concertly</Text>
        <Text style={styles.headerTitle}>Topluluklar</Text>
        <Text style={styles.headerSub}>
          Müzik zevkine, şehrine ve konser planına göre insanları bul.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{communities.length}</Text>
            <Text style={styles.statLabel}>Topluluk</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{joinedCount}</Text>
            <Text style={styles.statLabel}>Katıldın</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Topluluk, şehir veya tür ara..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map(filter => (
          <TouchableOpacity
            key={filter}
            onPress={() => setActiveFilter(filter)}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.list}>
        {filteredCommunities.map((community) => {
          const joined = !!joinedCommunities[community.id];

          return (
            <TouchableOpacity
              key={community.id}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('CommunityDetail', { community })}
              style={styles.communityCard}
            >
              <LinearGradient colors={community.gradient} style={styles.communityArt}>
                <Text style={styles.communityEmoji}>{community.emoji}</Text>
                {community.live && (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveText}>Canlı</Text>
                  </View>
                )}
              </LinearGradient>

              <View style={styles.communityBody}>
                <View style={styles.communityTop}>
                  <View style={styles.communityTitleArea}>
                    <Text style={styles.communityName} numberOfLines={1}>{community.name}</Text>
                    <Text style={styles.communityMeta}>{community.city} · {community.type}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleJoin(community.id)}
                    style={[styles.joinButton, joined && styles.joinButtonActive]}
                  >
                    <Text style={[styles.joinText, joined && styles.joinTextActive]}>
                      {joined ? 'Katıldın' : 'Katıl'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.communityDescription} numberOfLines={2}>
                  {community.description}
                </Text>

                <View style={styles.communityFooter}>
                  <Text style={styles.footerMetric}>{community.members.toLocaleString('tr-TR')} üye</Text>
                  <Text style={styles.footerMetric}>{community.posts} post</Text>
                  <Text style={styles.footerMetric}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
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

