import React, { useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRecyclingState } from '@shopify/flash-list';
import API from '../../services/api';
import { useTheme } from '../../theme';
import { hapticLight } from '../../utils/haptics';
import { useLanguage } from '../../context/LanguageContext';
import { formatTimeAgo } from '../../utils/time';
import PollCard from './PollCard';
import { openEvent } from '../../navigation/navHelpers';
import {
  publishPostUpdate, publishPostRemoved, publishUserHidden, isPostEdited,
} from '../../services/postUpdates';
import usePostActions from './usePostActions';
import { buildShareUrl, shareWithLink } from '../../services/shareLinks';

// Aksiyon satırı ikonları küçük; dokunma alanı 44 pt'ye tamamlanır
const ACTION_HIT_SLOP = { top: 10, bottom: 10, left: 6, right: 6 };

export default React.memo(function PostCard({
  item, index, currentUserId, navigation, onDelete, onEdit,
}) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;

  // Floating hearts
  const floatAnims = useRef([0, 1, 2].map(() => ({
    y:       new Animated.Value(0),
    opacity: new Animated.Value(0),
    x:       new Animated.Value(0),
  }))).current;

  const fireFloatingHearts = () => {
    floatAnims.forEach((a, i) => {
      a.y.setValue(0);
      a.opacity.setValue(0);
      a.x.setValue((i - 1) * 18);
      Animated.sequence([
        Animated.delay(i * 80),
        Animated.parallel([
          Animated.timing(a.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(a.y, { toValue: -60 - i * 12, duration: 700, useNativeDriver: true }),
          Animated.timing(a.x, { toValue: a.x._value + (i - 1) * 12, duration: 700, useNativeDriver: true }),
        ]),
        Animated.timing(a.opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  // Kart FlashList'te geri dönüştürülür: aynı bileşen başka bir gönderiye geçebilir.
  // Bu yüzden karta özel state gönderi kimliğine bağlı; kimlik değişince sıfırlanır
  // ve yarım kalmış kalp animasyonları yeni gönderide görünmez.
  const resetAnims = () => {
    scaleAnim.setValue(1);
    heartAnim.setValue(0);
    floatAnims.forEach(a => { a.y.setValue(0); a.opacity.setValue(0); a.x.setValue(0); });
  };
  // PostDetail'de değişen sayılar liste öğesine yazılır; kart onları göstersin
  const [liked, setLiked] = useRecyclingState(!!item.likedByMe, [item.id, item.likedByMe]);
  const [likeCount, setLikeCount] = useRecyclingState(item.likeCount || 0, [item.id, item.likeCount]);
  const [likeLoading, setLikeLoading] = useRecyclingState(false, [item.id], resetAnims);

  const currentIdRef = useRef(item.id);
  currentIdRef.current = item.id;

  const openDetail = () => navigation.navigate('PostDetail', { postId: item.id });

  // "⋯" menüsü (Düzenle/Sil ya da Şikâyet/Engelle) — PostDetail ile ortak
  const { openOptions, actionElements } = usePostActions({
    post: item,
    currentUserId,
    onDeleted: (id) => { onDelete?.(id); publishPostRemoved(id); },
    onEdited: (id, updated) => {
      onEdit?.(id, updated.content);
      publishPostUpdate(id, { content: updated.content, updatedAt: updated.updatedAt });
    },
    onBlocked: (userId) => publishUserHidden(userId),
  });

  // İyimser beğeni: kalp ve sayı hemen değişir; istek başarısız olursa eski hâline
  // döner ve kullanıcı bilgilendirilir. 409/404 (zaten beğenilmiş / beğeni yok)
  // istenen sonuçla aynı olduğu için başarı sayılır.
  const handleLike = async () => {
    if (likeLoading) return;
    hapticLight();
    const postId = item.id;
    const wasLiked = liked;
    const prevCount = likeCount;
    const nextCount = wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
    setLikeLoading(true);
    setLiked(!wasLiked);
    setLikeCount(nextCount);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.35, useNativeDriver: true, tension: 200 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    if (!wasLiked) {
      Animated.sequence([
        Animated.timing(heartAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(heartAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
      fireFloatingHearts();
    }
    // İstek sürerken kart başka gönderiye geçerse sonuç yeni gönderiye yazılmasın
    const stillSamePost = () => currentIdRef.current === postId;
    try {
      if (wasLiked) await API.delete(`/posts/${postId}/like`);
      else await API.post(`/posts/${postId}/like`);
      // Aynı gönderiyi gösteren diğer ekranlar (ana sayfa, profil) da güncellensin
      publishPostUpdate(postId, { likedByMe: !wasLiked, likeCount: nextCount });
    } catch (err) {
      const status = err?.response?.status;
      if ((!wasLiked && status === 409) || (wasLiked && status === 404)) {
        publishPostUpdate(postId, { likedByMe: !wasLiked, likeCount: nextCount });
      } else {
        if (stillSamePost()) {
          setLiked(wasLiked);
          setLikeCount(prevCount);
        }
        Alert.alert('', t('like_failed'));
      }
    } finally {
      if (stillSamePost()) setLikeLoading(false);
    }
  };

  const handleShare = async () => {
    const message = [
      item.eventName ? `🎵 ${item.eventName}` : '',
      item.content ? `"${item.content}"` : '',
      `— @${item.username}`,
      '',
      t('post_share_tagline'),
    ].filter((x, i) => x || i === 3).join('\n');
    await shareWithLink(message, buildShareUrl('post', item.id));
  };

  const goToUserProfile = () => {
    if (item.userId === currentUserId) {
      navigation.navigate('MainApp', { screen: 'Profile' });
    } else {
      navigation.navigate('UserProfile', { userId: item.userId });
    }
  };

  const heartOpacity = heartAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
  const heartScale = heartAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.4, 0.8] });

  return (
    <View style={styles.card}>
      {/* Animasyon kalpleri dokunmayı yakalamasın: saydamken bile içeriğin üstünde
          duruyor ve gönderi metnine dokunmak PostDetail yerine bunlara gidiyordu (web) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.floatingHeart, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}
      >
        <Ionicons name="heart" size={48} color={colors.primary} />
      </Animated.View>

      {/* Yükselen kalpler */}
      {floatAnims.map((a, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 44,
            left: 20 + i * 14,
            opacity: a.opacity,
            transform: [{ translateY: a.y }, { translateX: a.x }],
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <Ionicons name="heart" size={14 + i * 2} color={colors.primary} />
        </Animated.View>
      ))}

      {/* BAŞLIK */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={goToUserProfile} activeOpacity={0.75}>
          <View style={styles.avatar}>
            {item.userProfileImageUrl
              ? <Image source={{ uri: item.userProfileImageUrl }} style={styles.avatarImage} />
              : <Text style={styles.avatarText}>{item.username?.charAt(0).toUpperCase() || '?'}</Text>}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.username}>@{item.username}</Text>
            {item.eventName && item.eventId ? (
              // Konsere bağlı gönderide etkinlik adı ayrıca tıklanır → EventDetail
              <TouchableOpacity
                onPress={() => openEvent(navigation, item.eventId)}
                hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
                activeOpacity={0.7}
              >
                <View style={styles.eventTagRow}>
                  <Ionicons name="musical-notes-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.eventTag} numberOfLines={1}>{item.eventName}</Text>
                </View>
              </TouchableOpacity>
            ) : item.eventName ? (
              <View style={styles.eventTagRow}>
                <Ionicons name="musical-notes-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.eventTag} numberOfLines={1}>{item.eventName}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.postTime}>
            {formatTimeAgo(item.createdAt, lang)}
            {isPostEdited(item) ? ` · ${t('post_edited')}` : ''}
          </Text>
          <TouchableOpacity onPress={openOptions} style={styles.optionsBtn} accessibilityRole="button" accessibilityLabel={t('mod_options_title')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {actionElements}

      {/* İÇERİK — tıklayınca detay */}
      {item.content ? (
        <TouchableOpacity activeOpacity={0.85} onPress={openDetail}>
          <Text style={styles.content} numberOfLines={4}>{item.content}</Text>
        </TouchableOpacity>
      ) : null}
      {/* Görsel de detayı açar: yazısız görsel gönderisinin başka giriş noktası yoktu */}
      {item.postType === 'IMAGE' && !!item.imageUrl && (
        <TouchableOpacity activeOpacity={0.9} onPress={openDetail} accessibilityRole="imagebutton" accessibilityLabel={t('a11y_open_post')}>
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} contentFit="cover" transition={150} />
        </TouchableOpacity>
      )}
      {item.postType === 'POLL' && item.pollOptions && (
        <PollCard
          key={item.id}
          postId={item.id}
          options={item.pollOptions}
          // Oy listeye yazılır; kart geri dönüştürülüp tekrar gelince oy kaybolmaz
          onVoted={(pollOptions) => publishPostUpdate(item.id, { pollOptions })}
        />
      )}

      {/* AKSİYONLAR */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleLike}
          activeOpacity={0.7}
          hitSlop={ACTION_HIT_SLOP}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={`${t('a11y_like')}, ${likeCount}`}
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.primary : colors.textSecondary} />
          </Animated.View>
          <Text style={[styles.actionCount, liked && styles.actionCountActive]}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={openDetail}
          activeOpacity={0.7}
          hitSlop={ACTION_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`${t('a11y_comments')}, ${item.commentCount || 0}`}
        >
          <Ionicons name="chatbubble-outline" size={21} color={colors.textSecondary} />
          <Text style={styles.actionCount}>{item.commentCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7} hitSlop={ACTION_HIT_SLOP} accessibilityRole="button">
          <Ionicons name="share-outline" size={21} color={colors.textSecondary} />
          <Text style={styles.actionCount}>{t('share')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

function createStyles(colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card, borderRadius: 20, padding: 16,
      marginBottom: 14, borderWidth: 1, borderColor: colors.border,
      position: 'relative', overflow: 'hidden',
    },
    floatingHeart: {
      position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 10,
      pointerEvents: 'none',
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    optionsBtn: { padding: 4 },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    avatarText: { color: colors.text, fontWeight: 'bold', fontSize: 18 },
    headerInfo: { flex: 1 },
    username: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    eventTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    eventTag: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
    postTime: { fontSize: 11, color: colors.textSecondary },
    content: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 14 },
    postImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
    actions: {
      flexDirection: 'row', gap: 20, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
    actionCount: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    actionCountActive: { color: colors.primary },
  });
}
