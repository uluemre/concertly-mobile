import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { apiErrorMessage, isPrivateAccountError } from '../utils/communityErrors';

export default function FollowListScreen({ route, navigation }) {
  const { userId, type } = route.params;
  const { colors } = useTheme();
  const { session } = useAuth();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  // Sunucu followStatus göndermezse eski alana düşülür
  const statusOf = (u) => u.followStatus || (u.isFollowedByCurrentUser ? 'ACCEPTED' : 'NONE');

  const title = type === 'followers' ? t('follow_followers') : t('follow_following');

  useEffect(() => {
    navigation.setOptions({ title });
  }, []);

  // Ekrana her dönüşte yenilenir (N-27): profilde takipten çıkılan kişi burada
  // hâlâ "Takip Ediliyor" görünüp ikinci basışta hata vermesin
  useFocusEffect(useCallback(() => { fetchList(); }, [userId, type]));

  // Aynı kişiye istek sürerken gelen ikinci basış yok sayılır
  const pendingIds = useRef(new Set());

  const fetchList = async () => {
    try {
      const res = await API.get(`/users/${userId}/${type}`);
      setUsers(res.data);
      setLocked(false);
    } catch (err) {
      if (isPrivateAccountError(err)) {
        // Gizli hesabın listesi: genel hata yerine kilit mesajı
        setUsers([]);
        setLocked(true);
      } else {
        Alert.alert(t('error'), t('follow_load_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async (targetUser) => {
    if (targetUser.id === session.userId || pendingIds.current.has(targetUser.id)) return;
    pendingIds.current.add(targetUser.id);
    try {
      const status = statusOf(targetUser);
      let nextStatus;
      if (status === 'ACCEPTED' || status === 'PENDING') {
        // Takip ediliyor → takipten çık; istek beklemede → isteği iptal et
        await API.delete(`/users/${targetUser.id}/follow`);
        nextStatus = 'NONE';
      } else {
        await API.post(`/users/${targetUser.id}/follow`);
        nextStatus = targetUser.isPrivate ? 'PENDING' : 'ACCEPTED';
      }
      setUsers(prev =>
        prev.map(u =>
          u.id === targetUser.id
            ? { ...u, followStatus: nextStatus, isFollowedByCurrentUser: nextStatus === 'ACCEPTED' }
            : u
        )
      );
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'follow_action_error'));
    } finally {
      pendingIds.current.delete(targetUser.id);
    }
  };

  const renderUser = ({ item }) => {
    const isSelf = item.id === session.userId;
    const status = statusOf(item);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
        activeOpacity={0.8}
      >
        {item.profileImageUrl ? (
          <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.username}>@{item.username}</Text>
          {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
        </View>
        {!isSelf && (
          <TouchableOpacity
            style={[
              styles.followBtn,
              status === 'ACCEPTED' && styles.followBtnActive,
            ]}
            onPress={() => handleToggleFollow(item)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.followBtnText,
              status === 'ACCEPTED' && styles.followBtnTextActive,
            ]}>
              {status === 'ACCEPTED' ? t('follow_btn_active')
                : status === 'PENDING' ? t('user_profile_requested')
                : item.isPrivate ? t('follow_btn_request')
                : t('follow_btn')}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={users}
        keyExtractor={item => String(item.id)}
        renderItem={renderUser}
        contentContainerStyle={users.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{locked ? '🔒' : '👥'}</Text>
            <Text style={styles.emptyText}>
              {locked ? t('private_account_list_locked')
                : type === 'followers' ? t('follow_no_followers') : t('follow_no_following')}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    backText: { fontSize: 24, color: colors.text },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    avatarEmoji: { fontSize: 22 },
    info: { flex: 1, marginLeft: 12 },
    username: { fontSize: 15, fontWeight: '700', color: colors.text },
    city: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    followBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    followBtnActive: {
      backgroundColor: colors.primary,
    },
    followBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
    followBtnTextActive: { color: '#fff' },

    separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
    emptyContainer: { flex: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary },
  });
}
