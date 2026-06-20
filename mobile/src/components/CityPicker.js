import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, FlatList,
} from 'react-native';
import { TURKISH_CITIES, POPULAR_CITIES } from '../constants/cities';

// Türkçe-duyarlı normalleştirme: "ist" → "İstanbul" eşleşsin.
const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').trim();

/**
 * Şehir seçici. 81 ili tek tek chip basmak yerine popüler ~8 ili gösterir,
 * gerisi "＋ Diğer" ile açılan aranabilir modaldan seçilir. Seçilen şehir
 * popüler listede yoksa ayrıca aktif chip olarak gösterilir.
 *
 * props: value (string|null), onChange(city), colors, t
 */
export default function CityPicker({ value, onChange, colors, t }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');

  const showSelectedExtra = value && !POPULAR_CITIES.includes(value);
  const chips = showSelectedExtra ? [...POPULAR_CITIES, value] : POPULAR_CITIES;

  const filtered = query.trim()
    ? TURKISH_CITIES.filter(c => norm(c).includes(norm(query)))
    : TURKISH_CITIES;

  const pick = (city) => {
    onChange(city);
    setModalOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.row}>
      {chips.map(city => {
        const active = value === city;
        return (
          <TouchableOpacity
            key={city}
            onPress={() => onChange(city)}
            activeOpacity={0.8}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{city}</Text>
          </TouchableOpacity>
        );
      })}

      {/* ＋ Diğer — tüm illeri arama modalı */}
      <TouchableOpacity
        onPress={() => setModalOpen(true)}
        activeOpacity={0.8}
        style={[styles.chip, styles.chipMore]}
      >
        <Text style={styles.chipMoreText}>＋ {t('city_more')}</Text>
      </TouchableOpacity>

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('city_pick_title')}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.search}
              placeholder={t('city_search_ph')}
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
            />

            <FlatList
              data={filtered}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>{t('city_no_results')}</Text>
              }
              renderItem={({ item }) => {
                const active = value === item;
                return (
                  <TouchableOpacity
                    onPress={() => pick(item)}
                    activeOpacity={0.7}
                    style={styles.listItem}
                  >
                    <Text style={[styles.listItemText, active && styles.listItemTextActive]}>
                      {item}
                    </Text>
                    {active && <Text style={styles.listCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: '#E94560', borderColor: '#E94560' },
    chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: '#fff' },
    chipMore: { borderStyle: 'dashed', borderColor: '#E94560' },
    chipMoreText: { color: '#E94560', fontSize: 13, fontWeight: '800' },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 16,
      paddingHorizontal: 20,
      paddingBottom: 24,
      maxHeight: '75%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    modalClose: { color: colors.textSecondary, fontSize: 18, fontWeight: '700' },
    search: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      marginBottom: 8,
    },
    list: { flexGrow: 0 },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listItemText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    listItemTextActive: { color: '#E94560', fontWeight: '800' },
    listCheck: { color: '#E94560', fontSize: 16, fontWeight: '800' },
    empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  });
}
