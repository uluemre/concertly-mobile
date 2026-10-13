import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fonts } from '../../theme';
import { hapticSelection } from '../../utils/haptics';
import { eventTitle, shortDate } from './buddyUtils';

// Desteyi konsere ve müzik türüne göre daraltır
export default function BuddyFilterSheet({
  visible, onClose, t, locale,
  events, activeEvent, onEvent,
  genres, activeGenres, onGenres,
  activeCount, onClear,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const toggleGenre = (genre) => {
    hapticSelection();
    onGenres(activeGenres.includes(genre)
      ? activeGenres.filter(g => g !== genre)
      : [...activeGenres, genre]);
  };

  const chip = (key, label, on, onPress, role = 'radio') => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole={role}
      accessibilityState={{ checked: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('close')}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]} onPress={() => {}} accessible={false}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">{t('buddy_filter_title')}</Text>
            {activeCount > 0 ? (
              <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button">
                <Text style={styles.clear}>{t('buddy_filter_clear')}</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {events.length > 1 ? (
              <>
                <Text style={styles.label}>{t('buddy_filter_concert')}</Text>
                <View style={styles.wrap}>
                  {chip('all', t('buddy_filter_all'), !activeEvent, () => { hapticSelection(); onEvent(null); })}
                  {events.map(ev => chip(
                    ev.id,
                    `${eventTitle(ev)} · ${shortDate(ev.eventDate, locale)}`,
                    activeEvent === ev.id,
                    () => { hapticSelection(); onEvent(ev.id); },
                  ))}
                </View>
              </>
            ) : null}

            {genres.length > 0 ? (
              <>
                <Text style={styles.label}>{t('buddy_filter_genre')}</Text>
                <View style={styles.wrap}>
                  {genres.map(g => chip(g, g, activeGenres.includes(g), () => toggleGenre(g), 'checkbox'))}
                </View>
              </>
            ) : null}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.done} accessibilityRole="button">
            <Text style={styles.doneText}>{t('buddy_filter_done')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 22,
      paddingTop: 10,
      gap: 14,
      maxHeight: '85%',
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: colors.text, fontFamily: fonts.heading, fontSize: 22 },
    clear: { color: colors.primary, fontWeight: '600' },
    scroll: { flexGrow: 0 },
    scrollContent: { gap: 12 },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      maxWidth: '100%',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipOn: { backgroundColor: colors.purple, borderColor: colors.purple },
    chipText: { color: colors.textSecondary, fontWeight: '600' },
    chipTextOn: { color: '#fff' },
    done: {
      marginTop: 4,
      backgroundColor: colors.primary,
      borderRadius: 18,
      alignItems: 'center',
      paddingVertical: 14,
    },
    doneText: { color: '#fff', fontFamily: fonts.headingBold, fontSize: 16 },
  });
}
