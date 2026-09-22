import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, FlatList,
} from 'react-native';
import { TURKISH_CITIES, LAUNCH_CITIES, isLaunchCity } from '../constants/cities';

// Türkçe-duyarlı normalleştirme: "ist" → "İstanbul" eşleşsin.
const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').trim();

/**
 * Şehir seçici. İlk yayın kapsamındaki şehirler chip olarak öne çıkar; geri
 * kalan iller "＋ Diğer" ile açılan aranabilir modaldan seçilebilir.
 *
 * Kapsam dışı şehirleri de seçilebilir tutuyoruz: onboarding şehir seçmeden
 * ilerlemeye izin vermiyor (canContinue), dolayısıyla listeyi 4 şehre kısmak
 * diğer illerdeki kullanıcıyı kayıt akışında tamamen kilitliyordu. Kapsam
 * dışı seçimde etkinlik listesinin henüz boş olacağını ayrıca belirtiyoruz.
 *
 * props: value (string|null), onChange(city), colors, t
 */
export default function CityPicker({ value, onChange, colors, t }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');

  const showSelectedExtra = value && !LAUNCH_CITIES.includes(value);
  const chips = showSelectedExtra ? [...LAUNCH_CITIES, value] : LAUNCH_CITIES;
  const outOfScope = !!value && !isLaunchCity(value);

  const filtered = query.trim()
    ? TURKISH_CITIES.filter(c => norm(c).includes(norm(query)))
    : TURKISH_CITIES;

  const pick = (city) => {
    onChange(city);
    setModalOpen(false);
    setQuery('');
  };

  return (
    <View>
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
      </View>

      {/* Kapsam dışı şehir seçildiyse beklentiyi baştan doğru kur */}
      {outOfScope && <Text style={styles.soonHint}>{t('city_soon_hint')}</Text>}

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
                const launch = isLaunchCity(item);
                return (
                  <TouchableOpacity
                    onPress={() => pick(item)}
                    activeOpacity={0.7}
                    style={styles.listItem}
                  >
                    <Text style={[styles.listItemText, active && styles.listItemTextActive]}>
                      {item}
                    </Text>
                    {active
                      ? <Text style={styles.listCheck}>✓</Text>
                      : !launch && <Text style={styles.listSoon}>{t('city_soon_badge')}</Text>}
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
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: '#E94560', borderColor: '#E94560' },
    chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: '#fff' },
    chipMore: { borderStyle: 'dashed', borderColor: '#E94560' },
    chipMoreText: { color: '#E94560', fontSize: 13, fontWeight: '800' },

    soonHint: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 8,
      lineHeight: 17,
    },

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
    listSoon: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  });
}
