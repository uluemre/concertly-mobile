import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { communityTypeLabel } from '../utils/communityType';
import { useAuth } from '../context/AuthContext';
import API, { getErrorMessage } from '../services/api';
import CityPicker from '../components/CityPicker';
import { goBackOrFallback } from '../navigation/navHelpers';
import { communityErrorMessage } from '../utils/communityErrors';

const TYPES = ['Rock', 'Festival', 'Elektronik', 'Şehir', 'Caz', 'Pop', 'Rap', 'Diğer'];

// Hazır tema seçenekleri (emoji + degrade) — kullanıcı görsel asset yüklemeden seçer
const THEMES = [
  { emoji: '🎸', start: '#E94560', end: '#7C3AED' },
  { emoji: '🎪', start: '#F5A623', end: '#E94560' },
  { emoji: '🎧', start: '#00D4AA', end: '#0066FF' },
  { emoji: '📍', start: '#7C3AED', end: '#E94560' },
  { emoji: '🎷', start: '#16213E', end: '#F5A623' },
  { emoji: '🎤', start: '#00A8FF', end: '#7C3AED' },
  { emoji: '🔥', start: '#EC4899', end: '#BE123C' },
  { emoji: '🌙', start: '#3B82F6', end: '#1D4ED8' },
];

// Sunucu sınırıyla aynı: communities.description varchar(255) (A1)
const DESCRIPTION_MAX = 255;

const VISIBILITIES = [
  { value: 'PUBLIC',  labelKey: 'community_visibility_public',  descKey: 'community_visibility_public_desc',  icon: '🌍' },
  { value: 'PRIVATE', labelKey: 'community_visibility_private', descKey: 'community_visibility_private_desc', icon: '🔒' },
  { value: 'SECRET',  labelKey: 'community_visibility_secret',  descKey: 'community_visibility_secret_desc',  icon: '🕵️' },
];

const normalizeVisibility = (v) => {
  const up = (v || 'PUBLIC').toString().toUpperCase();
  return VISIBILITIES.some(x => x.value === up) ? up : 'PUBLIC';
};

export default function CreateCommunityScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t, tu } = useLanguage();
  const { session } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // BUG-03: { communityId, mode: 'edit' } ile açılırsa düzenleme modu (ad, açıklama, görünürlük)
  const editId = route?.params?.mode === 'edit' ? route?.params?.communityId : null;
  const isEdit = editId != null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Rock');
  const [city, setCity] = useState(session.userCity || null);
  const [themeIdx, setThemeIdx] = useState(0);
  const [visibility, setVisibility] = useState('PUBLIC');
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [editColors, setEditColors] = useState(null);
  const original = useRef(null);

  const theme = THEMES[themeIdx];

  useEffect(() => {
    if (!isEdit) return undefined;
    let alive = true;
    API.get(`/communities/${editId}`)
      .then(({ data }) => {
        if (!alive) return;
        if (!data?.canManage) {
          Alert.alert(t('error'), t('community_edit_not_allowed'));
          goBackOrFallback(navigation);
          return;
        }
        const init = {
          name: data.name || '',
          description: data.description || '',
          visibility: normalizeVisibility(data.visibility),
        };
        original.current = init;
        setName(init.name);
        setDescription(init.description);
        setVisibility(init.visibility);
        if (data.gradientStart && data.gradientEnd) {
          setEditColors({ start: data.gradientStart, end: data.gradientEnd, emoji: data.emoji || theme.emoji });
        }
        setLoadingEdit(false);
      })
      .catch((err) => {
        if (!alive) return;
        Alert.alert(t('error'), communityErrorMessage(err, t, 'community_edit_load_error'));
        goBackOrFallback(navigation);
      });
    return () => { alive = false; };
  }, [isEdit, editId]);

  const showError = (err) => {
    Alert.alert(t('error'), err?.response?.data?.message === 'COMMUNITY_DESCRIPTION_TOO_LONG'
      ? t('community_create_desc_too_long', { max: DESCRIPTION_MAX })
      : (isEdit ? communityErrorMessage(err, t, 'community_edit_error') : getErrorMessage(err)));
  };

  // Yalnız değişen alanlar gönderilir (sunucu null alanı değiştirmez)
  const editChanges = () => {
    const o = original.current || {};
    const body = {};
    if (name.trim() !== (o.name || '').trim()) body.name = name.trim();
    if (description.trim() !== (o.description || '').trim()) body.description = description.trim();
    if (visibility !== o.visibility) body.visibility = visibility;
    return body;
  };

  const saveEdit = async (body) => {
    setSubmitting(true);
    try {
      await API.put(`/communities/${editId}`, body);
      Alert.alert(t('success'), t('community_edit_success'));
      goBackOrFallback(navigation);
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = () => {
    if (submitting) return;
    if (!name.trim()) {
      Alert.alert(t('error'), t('community_create_name_required'));
      return;
    }
    const body = editChanges();
    if (Object.keys(body).length === 0) {
      goBackOrFallback(navigation);
      return;
    }
    // SEC-C02: ad/açıklama/görünürlük değişikliği topluluğu yeniden incelemeye alır — önce onay
    Alert.alert(t('community_edit_review_title'), t('community_edit_review_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('community_edit_review_confirm'), onPress: () => saveEdit(body) },
    ]);
  };

  const submit = async () => {
    if (isEdit) { submitEdit(); return; }
    if (!name.trim()) {
      Alert.alert(t('error'), t('community_create_name_required'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post('/communities', {
        name: name.trim(),
        description: description.trim(),
        type,
        city,
        emoji: theme.emoji,
        gradientStart: theme.start,
        gradientEnd: theme.end,
        visibility,
      });
      Alert.alert(t('success'), t('community_create_success'));
      navigation.replace('CommunityDetail', { communityId: res.data.id });
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEdit) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hero = isEdit && editColors ? editColors : theme;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[hero.start, hero.end]} style={styles.hero}>
          <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.backButton}>
            <Text style={styles.backText}>{t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.heroEmoji}>{hero.emoji}</Text>
          <Text style={styles.heroTitle}>
            {isEdit ? t('community_edit_title') : (name.trim() || t('community_create_title'))}
          </Text>
        </LinearGradient>

        {/* İsim */}
        <Text style={styles.label}>{tu('community_create_name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('community_create_name_ph')}
          placeholderTextColor={colors.textSecondary}
          maxLength={50}
        />

        {/* Açıklama */}
        <Text style={styles.label}>{tu('community_create_desc')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('community_create_desc_ph')}
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={DESCRIPTION_MAX}
        />

        {/* Tema, tür ve şehir yalnız oluşturmada (düzenleme: ad, açıklama, görünürlük) */}
        {!isEdit && (<>
        {/* Tema (emoji + renk) */}
        <Text style={styles.label}>{tu('community_create_emoji')}</Text>
        <View style={styles.themeRow}>
          {THEMES.map((th, i) => (
            <TouchableOpacity key={i} onPress={() => setThemeIdx(i)} activeOpacity={0.85}>
              <LinearGradient
                colors={[th.start, th.end]}
                style={[styles.themeChip, themeIdx === i && styles.themeChipActive]}
              >
                <Text style={styles.themeEmoji}>{th.emoji}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tür */}
        <Text style={styles.label}>{tu('community_create_type')}</Text>
        <View style={styles.chipRow}>
          {TYPES.map(tp => (
            <TouchableOpacity
              key={tp}
              onPress={() => setType(tp)}
              style={[styles.chip, type === tp && styles.chipActive]}
            >
              <Text style={[styles.chipText, type === tp && styles.chipTextActive]}>{communityTypeLabel(tp, t)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Şehir */}
        <Text style={styles.label}>{tu('community_create_city')}</Text>
        <CityPicker value={city} onChange={setCity} colors={colors} t={t} />
        </>)}

        {/* Görünürlük */}
        <Text style={styles.label}>{tu('community_create_visibility')}</Text>
        {VISIBILITIES.map(v => (
          <TouchableOpacity
            key={v.value}
            onPress={() => setVisibility(v.value)}
            activeOpacity={0.85}
            style={[styles.visCard, visibility === v.value && styles.visCardActive]}
          >
            <Text style={styles.visIcon}>{v.icon}</Text>
            <View style={styles.visTextCol}>
              <Text style={[styles.visLabel, visibility === v.value && styles.visLabelActive]}>{t(v.labelKey)}</Text>
              <Text style={styles.visDesc}>{t(v.descKey)}</Text>
            </View>
            <View style={[styles.radio, visibility === v.value && styles.radioActive]}>
              {visibility === v.value && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}

        {/* Onay bilgilendirmesi */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>ℹ️ {t(isEdit ? 'community_edit_info' : 'community_create_info')}</Text>
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={submitting || !name.trim()}
          activeOpacity={0.9}
          style={[styles.submitBtn, (submitting || !name.trim()) && styles.submitBtnDisabled]}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>{t(isEdit ? 'save' : 'community_create_submit')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 48 },
    hero: { paddingTop: 56, paddingBottom: 26, paddingHorizontal: 22, alignItems: 'center' },
    backButton: { alignSelf: 'flex-start', marginBottom: 8 },
    backText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    heroEmoji: { fontSize: 48, marginBottom: 8 },
    heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
    label: {
      color: colors.textSecondary, fontSize: 12, fontWeight: '800',
      letterSpacing: 0.5,
      marginHorizontal: 18, marginTop: 22, marginBottom: 10,
    },
    input: {
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12,
      color: colors.text, fontSize: 15,
    },
    textarea: { minHeight: 88, textAlignVertical: 'top' },
    themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
    themeChip: {
      width: 52, height: 52, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    themeChipActive: { borderColor: colors.text },
    themeEmoji: { fontSize: 24 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { backgroundColor: '#E94560', borderColor: '#E94560' },
    chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: '#fff' },
    visCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginHorizontal: 16, marginBottom: 10, padding: 14,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    },
    visCardActive: { borderColor: '#E94560', backgroundColor: '#E9456012' },
    visIcon: { fontSize: 22 },
    visTextCol: { flex: 1 },
    visLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
    visLabelActive: { color: '#E94560' },
    visDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 },
    radio: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 2, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    radioActive: { borderColor: '#E94560' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E94560' },
    infoBox: {
      marginHorizontal: 16, marginTop: 18,
      backgroundColor: colors.cardAlt || colors.card,
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
    },
    infoText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
    submitBtn: {
      marginHorizontal: 16, marginTop: 22,
      backgroundColor: '#E94560', borderRadius: 16,
      paddingVertical: 16, alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  });
}
