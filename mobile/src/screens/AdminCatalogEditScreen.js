import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList,
  StyleSheet, ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import API, { uploadImage, getApiUrl } from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { apiErrorMessage } from '../utils/communityErrors';
import { CATALOG_KINDS } from './AdminCatalogScreen';

// Sanatçı türü için hızlı seçenekler (etkinliklerde kullanılan türler); serbest yazı da olur
const GENRES = ['Pop', 'Rock', 'Rap', 'Alternatif Rock', 'Jazz', 'Elektronik', 'Klasik', 'Folk', 'Arabesk', 'Metal', 'Indie', 'R&B'];

const ERROR_KEYS = {
  ARTIST_NAME_TAKEN: 'admin_cat_err_name_taken',
  VENUE_EXISTS: 'admin_cat_err_venue_exists',
  INVALID_IMAGE_URL: 'admin_cat_err_image',
  INVALID_COORDINATES: 'admin_cat_err_coords',
  INVALID_NAME: 'admin_cat_err_name',
  INVALID_CITY: 'admin_cat_err_city',
  ARTIST_MERGED: 'admin_cat_err_merged',
  VENUE_MERGED: 'admin_cat_err_merged',
};

/**
 * Admin: tek bir sanatçının ya da mekânın bilgisini ve fotoğrafını düzenler.
 * Elle konan fotoğraf otomatik görevlerce değiştirilmez; "Otomatiğe döndür" kilidi kaldırır.
 */
export default function AdminCatalogEditScreen({ navigation, route }) {
  const kind = route?.params?.kind === 'venues' ? 'venues' : 'artists';
  const id = route?.params?.id;
  const isArtist = kind === 'artists';
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [item, setItem] = useState(null);
  const [draft, setDraft] = useState({});
  const [previewUri, setPreviewUri] = useState(null); // seçilen fotoğrafın yerel önizlemesi
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get(`${CATALOG_KINDS[kind].endpoint}/${id}`);
      setItem(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => { load(); }, [load]);

  const value = (key) => (key in draft ? draft[key] : (item?.[key] ?? ''));
  const str = (v) => (v === null || v === undefined ? '' : String(v));
  const changes = useMemo(() => {
    if (!item) return {};
    const out = {};
    Object.entries(draft).forEach(([k, v]) => {
      if (str(v).trim() !== str(item[k]).trim()) out[k] = typeof v === 'string' ? v.trim() : v;
    });
    return out;
  }, [draft, item]);
  const dirty = Object.keys(changes).length > 0;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const skipGuard = useRef(false);

  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (!dirtyRef.current || skipGuard.current) return;
    e.preventDefault();
    Alert.alert(t('admin_set_discard_title'), t('admin_set_discard_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('admin_set_discard'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
    ]);
  }), [navigation, t]);

  const set = (key, v) => setDraft(prev => ({ ...prev, [key]: v }));

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile_photo_perm_title'), t('profile_photo_perm_msg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: isArtist ? [1, 1] : [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const localUri = result.assets[0].uri;
    setUploading(true);
    try {
      const serverPath = await uploadImage(localUri);
      set('imageUrl', serverPath);
      setPreviewUri(localUri);
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'profile_photo_error'));
    } finally {
      setUploading(false);
    }
  };

  const resetPhoto = () => {
    set('imageUrl', '');
    setPreviewUri(null);
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      // Sunucu kendi yüklemelerimizi tam adres olarak döndürür; geri gönderirken göreli yol olmalı
      const body = { ...changes };
      const origin = getApiUrl().replace(/\/api$/, '');
      if (typeof body.imageUrl === 'string' && body.imageUrl.startsWith(`${origin}/uploads/`)) {
        body.imageUrl = body.imageUrl.slice(origin.length);
      }
      const res = await API.put(`${CATALOG_KINDS[kind].endpoint}/${id}`, body);
      setItem(res.data);
      setDraft({});
      setPreviewUri(null);
      Alert.alert(t('success'), t('admin_cat_saved'));
    } catch (err) {
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), ERROR_KEYS[code] ? t(ERROR_KEYS[code]) : apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const openPublic = () => {
    if (isArtist) navigation.navigate('ArtistProfile', { artistId: id, artistName: item?.name });
    else navigation.navigate('VenueProfile', { venueId: id, venueName: item?.name });
  };

  const openMap = () => {
    const lat = value('latitude');
    const lng = value('longitude');
    if (!lat || !lng) return;
    const url = Platform.OS === 'ios' ? `http://maps.apple.com/?ll=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  const mergeInto = (target) => {
    Alert.alert(
      t('admin_cat_merge_confirm_title'),
      t('admin_cat_merge_confirm_msg', { from: item.name, to: target.name }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('admin_cat_merge_ok'),
          style: 'destructive',
          onPress: async () => {
            try {
              await API.post(`/admin/merge/${kind}/${id}/into/${target.id}`);
              setMergeOpen(false);
              skipGuard.current = true;
              Alert.alert(t('success'), t('admin_cat_merged', { to: target.name }));
              navigation.replace('AdminCatalogEdit', { kind, id: target.id, name: target.name });
            } catch (err) {
              Alert.alert(t('error'), apiErrorMessage(err, t));
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const rawPhoto = previewUri || value('imageUrl');
  const photo = typeof rawPhoto === 'string' && rawPhoto.startsWith('/uploads/')
    ? getApiUrl().replace(/\/api$/, '') + rawPhoto
    : rawPhoto;
  const photoManual = isArtist
    ? ('imageUrl' in draft ? !!draft.imageUrl : item?.imageSource === 'ADMIN')
    : !!item?.adminEdited;

  const field = (key, label, opts = {}) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={str(value(key))}
        onChangeText={(x) => set(key, opts.numeric ? x.replace(/[^0-9.,-]/g, '') : x)}
        placeholder={opts.placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={opts.numeric ? 'numbers-and-punctuation' : 'default'}
        multiline={!!opts.multiline}
        style={[styles.input, opts.multiline && styles.inputMulti, key in changes && styles.inputChanged]}
        autoCorrect={false}
        accessibilityLabel={label}
      />
    </View>
  );

  const stat = (label, val) => (
    <View style={styles.stat} key={label}>
      <Text style={styles.statValue}>{val ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{item?.name || route?.params?.name || ''}</Text>
        <TouchableOpacity
          onPress={save}
          disabled={!dirty || saving}
          style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnOff]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !dirty || saving }}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>{t('save')}</Text>}
        </TouchableOpacity>
      </View>

      {error || !item ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.muted}>{t('admin_cat_load_error')}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.saveText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          {/* Fotoğraf */}
          <View style={styles.photoBlock}>
            <View style={[styles.photo, isArtist ? styles.photoArtist : styles.photoVenue]}>
              {photo ? (
                <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
              ) : (
                <Ionicons name={CATALOG_KINDS[kind].icon} size={48} color={colors.textSecondary} />
              )}
              {uploading ? (
                <View style={styles.photoBusy}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
            <Text style={styles.photoSource}>
              {photo
                ? (photoManual ? t('admin_cat_photo_manual') : t('admin_cat_photo_auto'))
                : t('admin_cat_photo_none')}
            </Text>
            <View style={styles.photoActions}>
              <TouchableOpacity onPress={pickPhoto} style={styles.primaryBtn} disabled={uploading} accessibilityRole="button">
                <Ionicons name="image-outline" size={16} color="#fff" />
                <Text style={styles.saveText}>{t('admin_cat_photo_pick')}</Text>
              </TouchableOpacity>
              {photo ? (
                <TouchableOpacity onPress={resetPhoto} style={styles.outlineBtn} accessibilityRole="button">
                  <Text style={styles.outlineText}>{isArtist ? t('admin_cat_photo_reset') : t('admin_cat_photo_remove')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Bilgiler */}
          <View style={styles.card}>
            {field('name', t('admin_cat_name'))}
            {isArtist ? (
              <>
                {field('genre', t('admin_cat_genre'), { placeholder: 'Pop' })}
                <View style={styles.chips}>
                  {GENRES.map(g => {
                    const on = str(value('genre')).toLocaleLowerCase('tr') === g.toLocaleLowerCase('tr');
                    return (
                      <TouchableOpacity key={g} onPress={() => set('genre', g)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{g}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                {field('city', t('admin_cat_city'))}
                {field('address', t('admin_cat_address'), { multiline: true })}
                <View style={styles.coordRow}>
                  <View style={{ flex: 1 }}>{field('latitude', t('admin_cat_lat'), { numeric: true, placeholder: '39.93' })}</View>
                  <View style={{ flex: 1 }}>{field('longitude', t('admin_cat_lng'), { numeric: true, placeholder: '32.85' })}</View>
                </View>
                {value('latitude') && value('longitude') ? (
                  <TouchableOpacity onPress={openMap} style={styles.linkRow} accessibilityRole="link">
                    <Ionicons name="map-outline" size={15} color={colors.primary} />
                    <Text style={styles.linkText}>{t('admin_cat_open_map')}</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
            {field('imageUrl', t('admin_cat_photo_link'), { placeholder: 'https://…' })}
            <Text style={styles.fieldHint}>{t('admin_cat_photo_link_hint')}</Text>
          </View>

          {(isArtist ? 'name' in changes : ('name' in changes || 'city' in changes)) ? (
            <View style={styles.note}>
              <Ionicons name="information-circle-outline" size={16} color={colors.secondary} />
              <Text style={styles.noteText}>{t('admin_cat_rename_note')}</Text>
            </View>
          ) : null}

          {/* Özet */}
          <View style={styles.stats}>
            {stat(t('admin_cat_stat_upcoming'), item.upcoming)}
            {stat(t('admin_cat_stat_past'), item.past)}
            {isArtist ? stat(t('admin_cat_stat_followers'), item.followers) : null}
          </View>
          {isArtist && item.spotifyId ? (
            <Text style={styles.muted}>{`Spotify: ${item.spotifyId}${item.genreTags ? ` · ${item.genreTags}` : ''}`}</Text>
          ) : null}
          {!isArtist && item.adminEdited ? <Text style={styles.muted}>{t('admin_cat_venue_locked')}</Text> : null}

          {/* İşlemler */}
          <TouchableOpacity onPress={openPublic} style={styles.actionRow} accessibilityRole="button">
            <Ionicons name="open-outline" size={18} color={colors.text} />
            <Text style={styles.actionText}>{isArtist ? t('admin_cat_open_artist') : t('admin_cat_open_venue')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMergeOpen(true)} style={styles.actionRow} accessibilityRole="button">
            <Ionicons name="git-merge-outline" size={18} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>{t('admin_cat_merge')}</Text>
              <Text style={styles.muted}>{t('admin_cat_merge_sub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {mergeOpen ? (
        <MergePicker
          kind={kind}
          selfId={id}
          onPick={mergeInto}
          onClose={() => setMergeOpen(false)}
          colors={colors}
          styles={styles}
          t={t}
        />
      ) : null}
    </View>
  );
}

/** Birleştirilecek hedefi seçmek için arama penceresi */
function MergePicker({ kind, selfId, onPick, onClose, colors, styles, t }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return undefined; }
    let alive = true;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const res = await API.get(CATALOG_KINDS[kind].endpoint, { params: { q: q.trim() } });
        if (alive) setRows((res.data || []).filter(r => r.id !== selfId));
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setBusy(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, kind, selfId]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{t('admin_cat_merge_pick')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalSearch}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder={t(CATALOG_KINDS[kind].searchKey)}
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.pickRow} onPress={() => onPick(item)} accessibilityRole="button">
              <View style={[styles.pickThumb, kind === 'artists' && { borderRadius: 20 }]}>
                {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionText} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {[kind === 'artists' ? item.genre : item.city, t('admin_cat_upcoming', { count: item.upcoming })].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={(
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 40 }]}>
              {q.trim().length < 2 ? t('admin_cat_merge_type') : busy ? '' : t('admin_cat_empty')}
            </Text>
          )}
        />
      </View>
    </Modal>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    saveBtn: { minWidth: 72, alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
    saveBtnOff: { opacity: 0.4 },
    saveText: { color: '#fff', fontWeight: '700' },

    content: { padding: 16, gap: 16 },
    photoBlock: { alignItems: 'center', gap: 10 },
    photo: { overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    photoArtist: { width: 160, height: 160, borderRadius: 80 },
    photoVenue: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16 },
    photoBusy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    photoSource: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
    photoActions: { flexDirection: 'row', gap: 10 },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
    },
    outlineBtn: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9 },
    outlineText: { color: colors.text, fontWeight: '600' },

    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 },
    field: { gap: 6, paddingVertical: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background,
      color: colors.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10,
    },
    inputMulti: { minHeight: 60, textAlignVertical: 'top' },
    inputChanged: { borderColor: colors.secondary },
    fieldHint: { fontSize: 11, color: colors.textSecondary, lineHeight: 15 },
    coordRow: { flexDirection: 'row', gap: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 6 },
    chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.background },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    chipTextOn: { color: '#fff' },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    linkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },

    note: { flexDirection: 'row', gap: 8, backgroundColor: `${colors.secondary}1A`, borderRadius: 12, padding: 10 },
    noteText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 17 },

    stats: { flexDirection: 'row', gap: 10 },
    stat: { flex: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center' },
    statValue: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    muted: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

    actionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 14,
    },
    actionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },

    modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    modalTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    modalSearch: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14 },
    pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
    pickThumb: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.card },
  });
}
