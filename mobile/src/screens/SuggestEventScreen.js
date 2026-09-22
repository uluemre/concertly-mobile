import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import CityPicker from '../components/CityPicker';

/**
 * Kullanıcı etkinlik önerisi.
 *
 * Ticketmaster Türkiye'deki konserlerin tamamını kapsamıyor; eksik konserleri
 * kullanıcıların bildirebilmesi veri kapsamını büyüten ikinci kanal.
 * Öneri admin onayına düşer, doğrulanmış organizatörlerde doğrudan yayınlanır.
 */
export default function SuggestEventScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [form, setForm] = useState({
    name: '',
    artistName: '',
    venueName: '',
    venueAddress: '',
    eventDate: '',
    ticketUrl: '',
    sourceUrl: '',
    description: '',
  });
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  /**
   * "2026-10-14 21:00" biçimini ISO'ya çevirir.
   * Tarih için ayrı bir kütüphane getirmemek adına metin olarak alınıyor;
   * biçim hatalıysa kullanıcıya sunucuya gitmeden burada söylüyoruz.
   */
  const parseDate = (value) => {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, y, mo, d, h, mi] = match;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
    if (Number.isNaN(date.getTime())) return null;
    return `${y}-${mo}-${d}T${h}:${mi}:00`;
  };

  const submit = async () => {
    if (!form.name.trim()) return Alert.alert(t('error'), t('suggest_error_name'));
    if (!form.venueName.trim()) return Alert.alert(t('error'), t('suggest_error_venue'));
    if (!city) return Alert.alert(t('error'), t('suggest_error_city'));

    const eventDate = parseDate(form.eventDate);
    if (!eventDate) return Alert.alert(t('error'), t('suggest_error_date'));

    setSaving(true);
    try {
      await API.post('/events/suggest', {
        name: form.name.trim(),
        artistName: form.artistName.trim() || null,
        venueName: form.venueName.trim(),
        venueCity: city,
        venueAddress: form.venueAddress.trim() || null,
        eventDate,
        ticketUrl: form.ticketUrl.trim() || null,
        sourceUrl: form.sourceUrl.trim() || null,
        description: form.description.trim() || null,
      });
      Alert.alert(t('suggest_success_title'), t('suggest_success_msg'), [
        { text: t('confirm'), onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      // 409 = aynı gün, aynı mekanda benzer isimli etkinlik zaten kayıtlı.
      const message =
        err.response?.status === 409
          ? t('suggest_duplicate')
          : err.response?.data?.message || t('suggest_error_generic');
      Alert.alert(t('error'), message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key, labelKey, options = {}) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{t(labelKey)}</Text>
      <TextInput
        style={[styles.input, options.multiline && styles.inputMultiline]}
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        placeholder={options.placeholder ? t(options.placeholder) : ''}
        placeholderTextColor={colors.textSecondary}
        multiline={options.multiline}
        autoCapitalize={options.autoCapitalize || 'sentences'}
        keyboardType={options.keyboardType || 'default'}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <LinearGradient colors={colors.headerGradient} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('suggest_title')}</Text>
          <Text style={styles.headerSub}>{t('suggest_subtitle')}</Text>
        </LinearGradient>

        {field('name', 'suggest_field_name', { placeholder: 'suggest_field_name_ph' })}
        {field('artistName', 'suggest_field_artist', { placeholder: 'suggest_field_artist_ph' })}
        {field('venueName', 'suggest_field_venue', { placeholder: 'suggest_field_venue_ph' })}

        <View style={styles.field}>
          <Text style={styles.label}>{t('suggest_field_city')}</Text>
          <CityPicker value={city} onChange={setCity} colors={colors} t={t} />
        </View>

        {field('venueAddress', 'suggest_field_address', { placeholder: 'suggest_field_address_ph' })}
        {field('eventDate', 'suggest_field_date', { placeholder: 'suggest_field_date_ph' })}
        {field('ticketUrl', 'suggest_field_ticket', {
          placeholder: 'suggest_field_ticket_ph',
          autoCapitalize: 'none',
          keyboardType: 'url',
        })}
        {field('sourceUrl', 'suggest_field_source', {
          placeholder: 'suggest_field_source_ph',
          autoCapitalize: 'none',
          keyboardType: 'url',
        })}
        {field('description', 'suggest_field_description', {})}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{t('suggest_review_note')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.6 }]}
          onPress={submit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{t('suggest_submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 48 },
    header: { paddingTop: 56, paddingBottom: 28, paddingHorizontal: 20, marginBottom: 24 },
    backButton: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
      marginBottom: 18,
    },
    backText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 6 },
    headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
    field: { paddingHorizontal: 20, marginBottom: 18 },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      color: colors.text, fontSize: 15,
    },
    inputMultiline: { height: 96, textAlignVertical: 'top' },
    noteBox: {
      marginHorizontal: 20, marginBottom: 20, padding: 14,
      borderRadius: 12, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
    },
    noteText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    submitBtn: {
      marginHorizontal: 20, paddingVertical: 16, borderRadius: 14,
      backgroundColor: colors.primary, alignItems: 'center',
    },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  });
