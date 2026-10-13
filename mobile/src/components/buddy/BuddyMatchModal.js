import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '../../theme';
import { eventTitle, longDate, scoreOf } from './buddyUtils';

function Avatar({ user, styles, extra }) {
  return user?.profileImageUrl ? (
    <Image source={{ uri: user.profileImageUrl }} style={[styles.photo, extra]} contentFit="cover" />
  ) : (
    <View style={[styles.photo, styles.photoFallback, extra]}>
      <Text style={styles.photoLetter}>{user?.username?.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// Eşleşme anı: iki fotoğraf, uyum, ortak konserler ve tek dokunuşla gönderilen ilk cümleler
// children: modalın üstünde çizilecek katman (konfeti; Modal dışındakiler altta kalır)
export default function BuddyMatchModal({ matchedUser, me, t, tu, locale, onChat, onClose, children }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  if (!matchedUser) return null;

  const shared = matchedUser.sharedEvents || [];
  const score = scoreOf(matchedUser);
  const icebreakers = [t('buddy_ice_1'), t('buddy_ice_2'), t('buddy_ice_3')];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <LinearGradient colors={['#2A0A24', '#0A0A14']} style={styles.screen}>
        <LinearGradient colors={[`${colors.primary}73`, 'transparent']} style={styles.glow} pointerEvents="none" />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>{tu('buddy_match_kicker')}</Text>
          <Text style={styles.title} accessibilityRole="header">{t('buddy_match_title')}</Text>
          <View style={styles.photos}>
            <Avatar user={me} styles={styles} extra={styles.left} />
            <Avatar user={matchedUser} styles={styles} extra={styles.right} />
          </View>
          <Text style={styles.names} numberOfLines={1}>
            {`@${me.username}  ×  @${matchedUser.username}`}
          </Text>
          {score > 0 ? (
            <View style={styles.scorePill}>
              <Text style={styles.score}>{`%${score} ${t('buddy_compat_label')}`}</Text>
            </View>
          ) : null}

          {shared.length ? (
            <View style={styles.shared}>
              <Text style={styles.sharedTitle}>{t('buddy_match_shared')}</Text>
              {shared.map(ev => (
                <Text key={ev.id} style={styles.sharedItem}>
                  {`✦ ${eventTitle(ev)}${ev.eventDate ? ` · ${longDate(ev.eventDate, locale)}` : ''}${ev.venueName ? ` · ${ev.venueName}` : ''}`}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyShared}>{t('buddy_match_no_shared')}</Text>
          )}

          <Text style={styles.iceTitle}>{t('buddy_icebreaker_title')}</Text>
          {icebreakers.map(text => (
            <TouchableOpacity key={text} style={styles.iceChip} onPress={() => onChat(text)} activeOpacity={0.85} accessibilityRole="button">
              <Text style={styles.iceText}>{text}</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.primary} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.primary} onPress={() => onChat(undefined)} activeOpacity={0.85} accessibilityRole="button">
            <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
            <Text style={styles.primaryText}>{t('buddy_send_message')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={styles.secondary}>{t('buddy_continue')}</Text>
          </TouchableOpacity>
        </ScrollView>
        {children}
      </LinearGradient>
    </Modal>
  );
}

// Eşleşme ekranı her iki temada koyu kalır (fotoğraf ve parıltı için tasarlandı)
function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1 },
    glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
    content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    kicker: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.6 },
    title: { color: '#fff', fontFamily: fonts.heading, fontSize: 34, marginTop: 6, textAlign: 'center' },
    photos: { width: 220, height: 140, marginVertical: 24 },
    photo: {
      width: 118,
      height: 118,
      borderRadius: 59,
      position: 'absolute',
      borderWidth: 3,
      borderColor: '#0A0A14',
    },
    photoFallback: { backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
    photoLetter: { color: '#fff', fontFamily: fonts.heading, fontSize: 44 },
    left: { left: 0, top: 8 },
    right: { right: 0, top: 0 },
    names: { color: '#fff', fontSize: 17, fontWeight: '700' },
    scorePill: {
      marginTop: 12,
      backgroundColor: `${colors.purple}40`,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    score: { color: '#fff', fontWeight: '600' },
    shared: {
      marginTop: 20,
      alignSelf: 'stretch',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 18,
      padding: 14,
      gap: 8,
    },
    sharedTitle: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
    sharedItem: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 },
    emptyShared: { marginTop: 18, color: 'rgba(255,255,255,0.75)' },
    iceTitle: {
      alignSelf: 'flex-start',
      color: 'rgba(255,255,255,0.6)',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginTop: 22,
      marginBottom: 8,
    },
    iceChip: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.primary}66`,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
    },
    iceText: { flex: 1, color: '#fff', fontSize: 14 },
    primary: {
      marginTop: 16,
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
    },
    primaryText: { color: '#fff', fontFamily: fonts.headingBold, fontSize: 17 },
    secondary: { marginTop: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  });
}
