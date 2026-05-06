import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

const samplePosts = [
  {
    id: 1,
    username: 'melis',
    content: 'Bu hafta sonu aynı etkinliğe giden var mı? Konser öncesi buluşma yapalım.',
    time: '12dk',
    likes: 18,
  },
  {
    id: 2,
    username: 'kaan',
    content: 'Son setlist çok iyi duruyor. Özellikle kapanış parçası efsane olur.',
    time: '1sa',
    likes: 31,
  },
  {
    id: 3,
    username: 'deniz',
    content: 'Mekan girişi için erken gitmek lazım, geçen sefer kuyruk çok uzundu.',
    time: '3sa',
    likes: 9,
  },
];

function getJoinedCommunities() {
  if (!global.joinedCommunities) {
    global.joinedCommunities = {};
  }
  return global.joinedCommunities;
}

export default function CommunityDetailScreen({ route, navigation }) {
  const { community } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const joinedCommunities = getJoinedCommunities();
  const [joined, setJoined] = useState(!!joinedCommunities[community.id]);
  const [draft, setDraft] = useState('');
  const [localPosts, setLocalPosts] = useState(samplePosts);

  const toggleJoin = () => {
    joinedCommunities[community.id] = !joined;
    setJoined(!joined);
  };

  const publishPost = () => {
    const content = draft.trim();
    if (!content) return;

    setLocalPosts(prev => [{
      id: Date.now(),
      username: 'sen',
      content,
      time: 'şimdi',
      likes: 0,
    }, ...prev]);
    setDraft('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient colors={community.gradient} style={styles.hero}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.heroEmoji}>{community.emoji}</Text>
        <Text style={styles.heroTitle}>{community.name}</Text>
        <Text style={styles.heroSub}>{community.description}</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{community.members.toLocaleString('tr-TR')}</Text>
            <Text style={styles.heroStatLabel}>Üye</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{community.posts + localPosts.length}</Text>
            <Text style={styles.heroStatLabel}>Post</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{community.city}</Text>
            <Text style={styles.heroStatLabel}>Bölge</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={toggleJoin}
          style={[styles.heroJoinButton, joined && styles.heroJoinButtonActive]}
        >
          <Text style={[styles.heroJoinText, joined && styles.heroJoinTextActive]}>
            {joined ? 'Topluluktasın' : 'Topluluğa Katıl'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sıradaki Konu</Text>
        <View style={styles.topicCard}>
          <Text style={styles.topicTitle}>{community.nextEvent}</Text>
          <Text style={styles.topicSub}>
            Topluluk bu başlık etrafında aktif. Etkinlik planları, bilet ve buluşma notları burada toplanır.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={joined ? 'Topluluğa bir şey yaz...' : 'Post atmak için topluluğa katıl'}
            placeholderTextColor={colors.textSecondary}
            editable={joined}
            multiline
            style={styles.composerInput}
          />
          <TouchableOpacity
            onPress={publishPost}
            disabled={!joined || !draft.trim()}
            style={[styles.publishButton, (!joined || !draft.trim()) && styles.publishButtonDisabled]}
          >
            <Text style={styles.publishText}>Paylaş</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Topluluk Akışı</Text>
        {localPosts.map(post => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{post.username.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.postHeaderText}>
                <Text style={styles.username}>@{post.username}</Text>
                <Text style={styles.postTime}>{post.time}</Text>
              </View>
            </View>
            <Text style={styles.postContent}>{post.content}</Text>
            <View style={styles.postFooter}>
              <Text style={styles.postAction}>♥ {post.likes}</Text>
              <Text style={styles.postAction}>Yanıtla</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 32 },
    hero: {
      paddingTop: 56,
      paddingBottom: 28,
      paddingHorizontal: 22,
      alignItems: 'center',
    },
    backButton: { alignSelf: 'flex-start', marginBottom: 12 },
    backText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '800' },
    heroEmoji: { fontSize: 54, marginBottom: 10 },
    heroTitle: { color: '#fff', fontSize: 25, fontWeight: 'bold', textAlign: 'center' },
    heroSub: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 8,
    },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 16,
      paddingVertical: 13,
      paddingHorizontal: 16,
      marginTop: 18,
      gap: 14,
    },
    heroStat: { alignItems: 'center' },
    heroStatNumber: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    heroStatLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 3 },
    heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.24)' },
    heroJoinButton: {
      marginTop: 18,
      backgroundColor: '#fff',
      borderRadius: 15,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    heroJoinButtonActive: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
    heroJoinText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
    heroJoinTextActive: { color: '#fff' },
    section: { paddingHorizontal: 16, marginTop: 16 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
    topicCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
    },
    topicTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 },
    topicSub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    composer: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
    },
    composerInput: {
      minHeight: 72,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    publishButton: {
      alignSelf: 'flex-end',
      marginTop: 10,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 16,
    },
    publishButtonDisabled: { opacity: 0.45 },
    publishText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    postCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 15,
      marginBottom: 11,
    },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
    postHeaderText: { flex: 1 },
    username: { color: colors.text, fontSize: 13, fontWeight: '800' },
    postTime: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    postContent: { color: colors.text, fontSize: 14, lineHeight: 20 },
    postFooter: { flexDirection: 'row', gap: 14, marginTop: 12 },
    postAction: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  });
}

