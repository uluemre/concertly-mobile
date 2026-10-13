import React, { useMemo } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '../../theme';
import EventImage from '../EventImage';
import { eventTitle, longDate, onPhoto, scoreOf } from './buddyUtils';

function Avatar({ user, styles }) {
  return user?.profileImageUrl ? (
    <Image source={{ uri: user.profileImageUrl }} style={styles.avatar} contentFit="cover" />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarLetter}>{user?.username?.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// Bir konser için arkadaş arayanlar: kart açmadan buradan da beğenilip geçilebilir.
// children: bu modalın üstünde açılacak modallar (profil, eşleşme). iOS bir modalın
// üstünde yalnızca onun içinde çizilen modalı gösterir.
export default function BuddyConcertModal({
  event, cards, matches, statusOf, toggling, t, locale,
  onClose, onToggle, onDecide, onOpenPerson, onChat, onEventPage, children,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  if (!event) return null;

  const sharesEvent = person => (person.sharedEvents || []).some(ev => ev.id === event.id);
  const people = cards.filter(sharesEvent);
  // Destede artık görünmeyen eşleşmeler de listede kalır (sohbete geçiş için)
  const matchedOnly = matches.filter(m => sharesEvent(m) && !people.some(p => p.userId === m.userId));
  const list = [...people, ...matchedOnly];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" statusBarTranslucent>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <EventImage item={{ ...event, name: eventTitle(event) }} style={StyleSheet.absoluteFill} initialsSize={40} />
            <LinearGradient colors={[onPhoto.fade, colors.background]} style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              onPress={onClose}
              style={[styles.back, { top: insets.top + 8 }]}
              accessibilityRole="button"
              accessibilityLabel={t('a11y_back')}
            >
              <Ionicons name="chevron-back" size={22} color={onPhoto.text} />
            </TouchableOpacity>
            <View style={[styles.heroText, { paddingTop: insets.top + 56 }]}>
              <Text style={styles.date}>{longDate(event.eventDate, locale)}</Text>
              <Text style={styles.artist} accessibilityRole="header">{eventTitle(event)}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[event.artistName ? event.name : null, event.venueName].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          <View style={[styles.toggleRow, event.lookingForBuddy && styles.toggleRowOn]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{t('buddy_concert_looking')}</Text>
              <Text style={styles.toggleSub}>{t('buddy_concerts_hint')}</Text>
            </View>
            {toggling === event.id ? (
              <ActivityIndicator color={colors.primary} style={{ width: 51 }} />
            ) : (
              <Switch
                value={!!event.lookingForBuddy}
                onValueChange={() => onToggle(event)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
                accessibilityLabel={t('a11y_buddy_switch', { name: eventTitle(event) })}
              />
            )}
          </View>

          <Text style={styles.section}>{t('buddy_concert_people')}</Text>
          <Text style={styles.hint}>{t('buddy_concert_people_hint')}</Text>

          {list.length === 0 ? (
            <Text style={[styles.hint, styles.empty]}>{t('buddy_concert_people_empty')}</Text>
          ) : null}

          {list.map((person) => {
            const status = statusOf(person.userId);
            const score = scoreOf(person);
            const isCard = people.includes(person);
            return (
              <View key={person.userId} style={styles.person}>
                <TouchableOpacity
                  style={styles.personMain}
                  onPress={() => (isCard ? onOpenPerson(person) : onChat(person))}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`@${person.username}${score ? `, %${score} ${t('buddy_compat_label')}` : ''}`}
                >
                  <Avatar user={person} styles={styles} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {person.fullName || `@${person.username}`}{person.age ? `, ${person.age}` : ''}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {[person.city, score ? `%${score} ${t('buddy_compat_label')}` : null].filter(Boolean).join(' · ')}
                    </Text>
                    {person.sharedArtists?.length ? (
                      <Text style={styles.artists} numberOfLines={1}>{person.sharedArtists.slice(0, 2).join(', ')}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
                {status === 'open' ? (
                  <View style={styles.actions}>
                    <TouchableOpacity onPress={() => onDecide(person, false)} style={styles.smallPass} accessibilityRole="button" accessibilityLabel={`${t('buddy_pass')}: @${person.username}`}>
                      <Ionicons name="close" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDecide(person, true)} style={styles.smallLike} accessibilityRole="button" accessibilityLabel={`${t('buddy_like')}: @${person.username}`}>
                      <Ionicons name="heart" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : status === 'matched' ? (
                  <TouchableOpacity onPress={() => onChat(person)} style={styles.chatBtn} accessibilityRole="button">
                    <Text style={styles.chatText}>{t('buddy_chat')}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.done}>{t('buddy_seen')}</Text>
                )}
              </View>
            );
          })}

          <TouchableOpacity onPress={() => onEventPage(event.id)} style={styles.eventLink} accessibilityRole="button">
            <Ionicons name="ticket-outline" size={16} color={colors.primary} />
            <Text style={styles.eventLinkText}>{t('buddy_open_event')}</Text>
          </TouchableOpacity>
        </ScrollView>
        {children}
      </View>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    hero: { height: 280 },
    back: {
      position: 'absolute',
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: onPhoto.badge,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    heroText: { flex: 1, justifyContent: 'flex-end', padding: 20 },
    date: { color: colors.secondary, fontWeight: '600' },
    artist: { color: colors.text, fontFamily: fonts.heading, fontSize: 32 },
    meta: { color: colors.textSecondary },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginTop: 4,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleRowOn: { borderColor: colors.primary, backgroundColor: `${colors.primary}14` },
    toggleTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
    toggleSub: { color: colors.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
    section: {
      color: colors.text,
      fontFamily: fonts.headingBold,
      fontSize: 20,
      paddingHorizontal: 20,
      marginTop: 22,
    },
    hint: { color: colors.textSecondary, paddingHorizontal: 20, marginTop: 6, marginBottom: 12, lineHeight: 18 },
    empty: { color: colors.text },
    person: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 12,
      gap: 12,
    },
    personMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 58, height: 58, borderRadius: 29 },
    avatarFallback: { backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
    avatarLetter: { color: '#fff', fontFamily: fonts.headingBold, fontSize: 22 },
    name: { color: colors.text, fontSize: 16, fontWeight: '700' },
    sub: { color: colors.textSecondary, fontSize: 13 },
    artists: { color: colors.primary, fontSize: 12, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8 },
    smallPass: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallLike: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: `${colors.primary}66`,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chatText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
    done: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
    eventLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 16,
      paddingVertical: 12,
    },
    eventLinkText: { color: colors.primary, fontWeight: '700' },
  });
}
