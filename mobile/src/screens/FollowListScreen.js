import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useTheme } from '../theme';
import API from '../services/api';

export default function FollowListScreen({ route, navigation }) {
  const { userId, type } = route.params; // type: 'followers' | 'following'
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const title = type === 'followers' ? 'Takipçiler' : 'Takip Edilenler';

  useEffect(() => {
    navigation.setOptions({ title });
    fetchList();
  }, []);

  const fetchList = async () => {
    try {
      const res = await API.get(`/users/${userId}/${type}`);
      setUsers(res.data);
    } catch (err) {
      Alert.alert('Hata', 'Liste yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async (targetUser) => {
    if (targetUser.id === global.userId) return;
    try {
      if (targetUser.isFollowedByCurrentUser) {
        await API.delete(`/users/${targetUser.id}/follow`);
      } else {
        await API.post(`/users/${targetUser.id}/follow`);
      }
      setUsers(prev =>
        prev.map(u =>
          u.id === targetUser.id
            ? { ...u, isFollowedByCurrentUser: !u.isFollowedByCurrentUser }
            : u
        )
      );
    } catch (err) {
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
    }
  };

  const renderUser = ({ item }) => {
    const isSelf = item.id === global.userId;
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
              item.isFollowedByCurrentUser && styles.followBtnActive,
            ]}
            onPress={() => handleToggleFollow(item)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.followBtnText,
              item.isFollowedByCurrentUser && styles.followBtnTextActive,
            ]}>
              {item.isFollowedByCurrentUser ? 'Takip Ediliyor' : 'Takip Et'}
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>
              {type === 'followers' ? 'Henüz takipçi yok' : 'Henüz kimse takip edilmiyor'}
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
