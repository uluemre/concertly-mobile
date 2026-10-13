import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from '../components/keyboard';
import API, { uploadImage, getApiUrl } from '../services/api';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { goBackOrFallback } from '../navigation/navHelpers';
import { apiErrorMessage } from '../utils/communityErrors';

const origin = () => getApiUrl().replace(/\/api$/, '');
const relative = (url) => (url && url.startsWith(`${origin()}/uploads/`) ? url.slice(origin().length) : url);

/** Organizatör kendi herkese açık profilini düzenler (ad admin onaylı olduğu için değişmez). */
export default function OrganizerProfileEditScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [initial, setInitial] = useState(null);
  const [form, setForm] = useState({ bio: '', website: '', instagram: '', logoUrl: '' });
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    API.get('/organizer/me').then(res => {
      const o = res.data?.organizer || {};
      const f = { bio: o.bio || '', website: o.website || '', instagram: o.instagram || '', logoUrl: o.logoUrl || '', name: o.name, id: o.id };
      setInitial(f);
      setForm(f);
    }).catch(() => Alert.alert(t('error'), t('org_load_error')));
  }, [t]);

  const dirty = initial && ['bio', 'website', 'instagram', 'logoUrl'].some(k => (form[k] || '') !== (initial[k] || ''));
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (!dirtyRef.current || leaving.current) return;
    e.preventDefault();
    Alert.alert(t('admin_set_discard_title'), t('admin_set_discard_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('admin_set_discard'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
    ]);
  }), [navigation, t]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile_photo_perm_title'), t('profile_photo_perm_msg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const path = await uploadImage(result.assets[0].uri);
      set('logoUrl', path);
      setPreview(result.assets[0].uri);
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'profile_photo_error'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!dirty || saving) return;
    const body = {};
    ['bio', 'website', 'instagram'].forEach(k => { if ((form[k] || '') !== (initial[k] || '')) body[k] = form[k].trim(); });
    if (form.logoUrl !== initial.logoUrl) body.logoUrl = relative(form.logoUrl || '');
    setSaving(true);
    try {
      await API.put('/organizer/profile', body);
      leaving.current = true;
      Alert.alert(t('success'), t('orgp_saved'), [{ text: t('confirm'), onPress: () => goBackOrFallback(navigation, 'Organizer') }]);
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const logo = preview || (form.logoUrl?.startsWith('/uploads/') ? origin() + form.logoUrl : form.logoUrl);

  const field = (key, label, opts = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => set(key, v)}
        placeholder={opts.placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, opts.multiline && styles.inputMulti]}
        multiline={!!opts.multiline}
        maxLength={opts.maxLength}
        autoCapitalize={opts.autoCapitalize || 'sentences'}
        keyboardType={opts.keyboardType || 'default'}
        autoCorrect={!opts.noCorrect}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Organizer')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('orgp_edit')}</Text>
        <TouchableOpacity onPress={save} disabled={!dirty || saving} style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.4 }]} accessibilityRole="button">
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>{t('save')}</Text>}
        </TouchableOpacity>
      </View>
      {!initial ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.logoBlock}>
            <TouchableOpacity onPress={pickLogo} style={styles.logo} disabled={uploading} accessibilityRole="button" accessibilityLabel={t('orgp_logo')}>
              {logo ? <Image source={{ uri: logo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="business" size={36} color={colors.primary} />}
              {uploading ? <View style={styles.busy}><ActivityIndicator color="#fff" /></View> : null}
            </TouchableOpacity>
            <Text style={styles.name}>{initial.name}</Text>
            <Text style={styles.hint}>{t('orgp_logo_hint')}</Text>
          </View>
          {field('bio', t('orgp_bio'), { multiline: true, maxLength: 1000, placeholder: t('orgp_bio_ph') })}
          {field('website', t('org_field_website'), { placeholder: 'https://', autoCapitalize: 'none', keyboardType: 'url', noCorrect: true, maxLength: 500 })}
          {field('instagram', t('org_field_instagram'), { placeholder: '@hesap', autoCapitalize: 'none', noCorrect: true, maxLength: 500 })}
          {initial.id ? (
            <TouchableOpacity onPress={() => navigation.navigate('OrganizerProfile', { organizerId: initial.id })} style={styles.viewLink} accessibilityRole="link">
              <Ionicons name="eye-outline" size={16} color={colors.primary} />
              <Text style={styles.viewText}>{t('orgp_view_public')}</Text>
            </TouchableOpacity>
          ) : null}
        </KeyboardAwareScrollView>
      )}
    </View>
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
    saveBtn: { minWidth: 72, alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
    saveText: { color: '#fff', fontWeight: '700' },
    content: { padding: 16, gap: 6 },
    logoBlock: { alignItems: 'center', gap: 6, marginBottom: 10 },
    logo: { width: 100, height: 100, borderRadius: 24, overflow: 'hidden', backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    hint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
    field: { marginBottom: 12 },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
    inputMulti: { minHeight: 110, textAlignVertical: 'top' },
    viewLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
    viewText: { color: colors.primary, fontWeight: '700' },
  });
}
