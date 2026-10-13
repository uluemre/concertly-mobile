import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from '../components/keyboard';
import API, { uploadImage, getApiUrl } from '../services/api';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import CityPicker from '../components/CityPicker';
import { goBackOrFallback } from '../navigation/navHelpers';
import { apiErrorMessage } from '../utils/communityErrors';

const ERROR_KEYS = {
  EVENT_PAST: 'org_err_event_past',
  DATE_IN_PAST: 'org_err_date_past',
  CITY_NOT_SUPPORTED: 'org_err_city',
  INVALID_TICKET_URL: 'org_err_ticket',
  INVALID_IMAGE_URL: 'org_err_image',
  INVALID_NAME: 'org_err_event_name',
  NOT_YOUR_EVENT: 'org_err_not_yours',
  NOT_ORGANIZER: 'org_err_not_organizer',
  TICKET_URL_REQUIRED: 'org_err_ticket_required',
  VENUE_REQUIRED: 'org_err_venue_pick',
  VENUE_NOT_FOUND: 'org_err_venue_pick',
};

// "14102026" → "14.10.2026", "2130" → "21:30" (yazarken biçimlenir)
const maskDate = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('.');
};
const maskTime = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

/** "14.10.2026" + "21:30" → "2026-10-14T21:30:00" (geçersizse null) */
function toIso(date, time) {
  const dm = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const tm = time.match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [, d, mo, y] = dm;
  const [, h, mi] = tm;
  const probe = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (probe.getDate() !== Number(d) || probe.getMonth() !== Number(mo) - 1 || Number(h) > 23 || Number(mi) > 59) return null;
  return `${y}-${mo}-${d}T${h}:${mi}:00`;
}

const serverOrigin = () => getApiUrl().replace(/\/api$/, '');
const relativeUpload = (url) => (url && url.startsWith(`${serverOrigin()}/uploads/`) ? url.slice(serverOrigin().length) : url);

/**
 * Organizatör: yeni etkinlik ekle ya da kendi etkinliğini düzenle.
 * Etkinlik onay beklemeden yayına girer; aynı gün aynı mekânda benzer etkinlik varsa 409.
 */
export default function OrganizerEventFormScreen({ navigation, route }) {
  const editing = route?.params?.event || null;
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const initial = useMemo(() => {
    const iso = editing?.eventDate || '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return {
      name: editing?.name || '',
      artistName: editing?.artistName || '',
      venueId: editing?.venueId || null,
      venueName: editing?.venueName || '',
      venueCity: editing?.venueCity || '',
      venueAddress: editing?.venueAddress || '',
      date: m ? `${m[3]}.${m[2]}.${m[1]}` : '',
      time: m ? `${m[4]}:${m[5]}` : '',
      ticketUrl: editing?.ticketUrl || '',
      description: editing?.description || '',
      imageUrl: editing?.imageUrl || '',
    };
  }, [editing]);

  const [form, setForm] = useState(initial);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [venueOpen, setVenueOpen] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const pickVenue = (v) => {
    setForm(prev => ({ ...prev, venueId: v.id, venueName: v.name, venueCity: v.city || '', venueAddress: v.address || '' }));
    setVenueOpen(false);
  };

  const dirty = Object.keys(initial).some(k => String(form[k] ?? '') !== String(initial[k] ?? ''));
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const leaving = useRef(false);

  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (!dirtyRef.current || leaving.current) return;
    e.preventDefault();
    Alert.alert(t('admin_set_discard_title'), t('admin_set_discard_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('admin_set_discard'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
    ]);
  }), [navigation, t]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile_photo_perm_title'), t('profile_photo_perm_msg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      const path = await uploadImage(uri);
      set('imageUrl', path);
      setPreview(uri);
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'profile_photo_error'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) return Alert.alert(t('error'), t('org_err_event_name'));
    const eventDate = toIso(form.date, form.time);
    if (!eventDate) return Alert.alert(t('error'), t('org_err_date_format'));
    if (new Date(eventDate) < new Date()) return Alert.alert(t('error'), t('org_err_date_past'));
    if (!form.venueId) return Alert.alert(t('error'), t('org_err_venue_pick'));
    const ticketUrl = form.ticketUrl.trim();
    if (!ticketUrl) return Alert.alert(t('error'), t('org_err_ticket_required'));
    if (!/^https?:\/\/\S+$/i.test(ticketUrl)) return Alert.alert(t('error'), t('org_err_ticket'));

    const body = {
      name: form.name.trim(),
      artistName: form.artistName.trim() || null,
      venueId: form.venueId,
      eventDate,
      ticketUrl,
      description: form.description.trim(),
    };
    // Görsel yalnız değiştiyse gönderilir (sunucunun döndürdüğü tam adres geri gönderilemez)
    if (form.imageUrl !== initial.imageUrl) body.imageUrl = relativeUpload(form.imageUrl.trim());
    if (!editing && !body.imageUrl) delete body.imageUrl;
    if (!editing && !body.description) body.description = null;

    setSaving(true);
    try {
      if (editing) await API.put(`/organizer/events/${editing.id}`, body);
      else await API.post('/organizer/events', body);
      leaving.current = true;
      Alert.alert(t('success'), editing ? t('org_event_updated') : t('org_event_created'), [
        { text: t('confirm'), onPress: () => goBackOrFallback(navigation, 'Organizer') },
      ]);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.message;
      const message = status === 409 ? t('org_err_duplicate')
        : ERROR_KEYS[code] ? t(ERROR_KEYS[code])
        : apiErrorMessage(err, t);
      Alert.alert(t('error'), message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, opts = {}) => (
    <View style={[styles.field, opts.half && { flex: 1 }]} key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, opts.multiline && styles.inputMulti]}
        value={form[key]}
        onChangeText={(v) => set(key, opts.mask ? opts.mask(v) : v)}
        placeholder={opts.placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={!!opts.multiline}
        autoCapitalize={opts.autoCapitalize || 'sentences'}
        keyboardType={opts.keyboardType || 'default'}
        autoCorrect={!opts.noCorrect}
        maxLength={opts.maxLength}
        accessibilityLabel={label}
      />
    </View>
  );

  const shownImage = preview || (form.imageUrl?.startsWith('/uploads/') ? serverOrigin() + form.imageUrl : form.imageUrl);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Organizer')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? t('org_edit_event') : t('org_add_event')}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <TouchableOpacity onPress={pickImage} style={styles.poster} activeOpacity={0.85} disabled={uploading} accessibilityRole="button" accessibilityLabel={t('org_pick_poster')}>
          {shownImage ? (
            <Image source={{ uri: shownImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={styles.posterEmpty}>
              <Ionicons name="image-outline" size={30} color={colors.textSecondary} />
              <Text style={styles.muted}>{t('org_pick_poster')}</Text>
            </View>
          )}
          {uploading ? <View style={styles.posterBusy}><ActivityIndicator color="#fff" /></View> : null}
        </TouchableOpacity>
        <Text style={styles.hint}>{t('org_poster_hint')}</Text>

        {field('name', t('suggest_field_name'), { placeholder: t('suggest_field_name_ph'), maxLength: 200 })}
        {field('artistName', t('suggest_field_artist'), { placeholder: t('suggest_field_artist_ph'), maxLength: 120 })}
        <View style={styles.row}>
          {field('date', t('org_field_date'), { placeholder: 'GG.AA.YYYY', keyboardType: 'number-pad', mask: maskDate, half: true })}
          {field('time', t('org_field_time'), { placeholder: '21:00', keyboardType: 'number-pad', mask: maskTime, half: true })}
        </View>
        {/* Mekân yalnız kayıtlı mekânlar arasından seçilir */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('org_field_venue')}</Text>
          <TouchableOpacity style={styles.venueBtn} onPress={() => setVenueOpen(true)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('org_field_venue')}>
            <Ionicons name="location-outline" size={18} color={form.venueId ? colors.primary : colors.textSecondary} />
            <View style={{ flex: 1 }}>
              {form.venueId ? (
                <>
                  <Text style={styles.venueName} numberOfLines={1}>{form.venueName}</Text>
                  <Text style={styles.venueMeta} numberOfLines={1}>{[form.venueCity, form.venueAddress].filter(Boolean).join(' · ')}</Text>
                </>
              ) : (
                <Text style={styles.venuePlaceholder}>{t('org_venue_pick')}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.hint}>{t('org_venue_missing')}</Text>
        </View>
        {field('ticketUrl', `${t('suggest_field_ticket')} *`, { placeholder: 'https://', autoCapitalize: 'none', keyboardType: 'url', noCorrect: true })}
        {field('description', t('suggest_field_description'), { multiline: true, maxLength: 4000 })}

        <View style={styles.note}>
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
          <Text style={styles.noteText}>{t('org_publish_note')}</Text>
        </View>

        <TouchableOpacity onPress={submit} disabled={saving || uploading} style={[styles.submit, (saving || uploading) && { opacity: 0.6 }]} accessibilityRole="button">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{editing ? t('save') : t('org_publish')}</Text>}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {venueOpen ? (
        <VenuePicker
          initialCity={form.venueCity}
          selectedId={form.venueId}
          onPick={pickVenue}
          onClose={() => setVenueOpen(false)}
          styles={styles}
          colors={colors}
          t={t}
        />
      ) : null}
    </View>
  );
}

/** Kayıtlı mekânlar arasından seçim: şehir + ada göre arama */
function VenuePicker({ initialCity, selectedId, onPick, onClose, styles, colors, t }) {
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState(initialCity || '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const res = await API.get('/organizer/venues', { params: { q: q.trim() || undefined, city: city || undefined } });
        if (alive) setRows(res.data || []);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setBusy(false);
      }
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, city]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{t('org_venue_pick')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <CityPicker value={city} onChange={setCity} colors={colors} t={t} />
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('org_venue_search')}
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(v) => String(v.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => {
            const on = item.id === selectedId;
            return (
              <TouchableOpacity style={styles.venueRow} onPress={() => onPick(item)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Ionicons name={on ? 'radio-button-on' : 'location-outline'} size={18} color={on ? colors.primary : colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.venueName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.venueMeta} numberOfLines={1}>{[item.city, item.address].filter(Boolean).join(' · ')}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={busy ? null : (
            <Text style={styles.emptyVenues}>{t('org_venue_none')}</Text>
          )}
        />
      </View>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    content: { padding: 16 },
    poster: {
      width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    posterEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    posterBusy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    hint: { fontSize: 11, color: colors.textSecondary, marginTop: 6, marginBottom: 12 },
    muted: { fontSize: 13, color: colors.textSecondary },
    row: { flexDirection: 'row', gap: 10 },
    field: { marginBottom: 14 },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15,
    },
    inputMulti: { minHeight: 100, textAlignVertical: 'top' },
    note: { flexDirection: 'row', gap: 8, backgroundColor: `${colors.accent}14`, borderRadius: 12, padding: 12, marginBottom: 16 },
    noteText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
    submit: { backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', paddingVertical: 16 },
    venueBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    venueName: { fontSize: 15, fontWeight: '700', color: colors.text },
    venueMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    venuePlaceholder: { fontSize: 15, color: colors.textSecondary },
    modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    modalTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    modalBody: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
    venueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    emptyVenues: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, paddingHorizontal: 32, lineHeight: 20 },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  });
}
