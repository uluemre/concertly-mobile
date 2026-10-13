import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { useAppConfig } from '../context/AppConfigContext';
import API from '../services/api';
import { goBackOrFallback } from '../navigation/navHelpers';
import { apiErrorMessage } from '../utils/communityErrors';
import { dateLocale } from '../utils/time';

// Ekrandaki bölümler ve sıraları. Anahtarlar backend'deki AppSettingsService ile aynı.
const FEATURES = [
  ['feature.buddy', 'admin_set_feature_buddy', 'person-add-outline'],
  ['feature.games', 'admin_set_feature_games', 'game-controller-outline'],
  ['feature.communities', 'admin_set_feature_communities', 'people-outline'],
  ['feature.posting', 'admin_set_feature_posting', 'create-outline'],
  ['feature.event_suggestions', 'admin_set_feature_suggestions', 'add-circle-outline'],
  ['feature.registration', 'admin_set_feature_registration', 'person-circle-outline'],
];
const LIMITS = [
  ['limits.new_account_hours', 'admin_set_limit_hours'],
  ['limits.new_account_max_posts', 'admin_set_limit_posts'],
  ['limits.new_account_max_comments', 'admin_set_limit_comments'],
  ['limits.new_account_max_messages', 'admin_set_limit_messages'],
  ['limits.uploads_per_day', 'admin_set_limit_uploads'],
  ['limits.new_account_uploads_per_day', 'admin_set_limit_new_uploads'],
];
const TONES = [['info', 'admin_set_tone_info'], ['warning', 'admin_set_tone_warning'], ['success', 'admin_set_tone_success']];
const TEXT_MAX = 300;

const ERROR_KEYS = {
  SETTING_OUT_OF_RANGE: 'admin_set_err_range',
  INVALID_LINK: 'admin_set_err_link',
  SETTING_TOO_LONG: 'admin_set_err_long',
  INVALID_SETTING_VALUE: 'admin_set_err_value',
};

/**
 * Uygulama ayarları: bakım modu, duyuru bandı, özellik anahtarları ve yeni hesap limitleri.
 * Değişiklikler önce taslakta toplanır, "Kaydet" ile birlikte gönderilir; her kayıt
 * işlem kaydına düşer.
 */
export default function AdminSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { refresh: refreshAppConfig } = useAppConfig();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [settings, setSettings] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const byKey = useMemo(() => Object.fromEntries(settings.map(s => [s.key, s])), [settings]);
  const value = (key) => (key in draft ? draft[key] : byKey[key]?.value ?? '');
  const isTrue = (key) => value(key) === 'true';

  const changes = useMemo(() => {
    const out = {};
    Object.entries(draft).forEach(([k, v]) => {
      if (byKey[k] && String(v) !== byKey[k].value) out[k] = String(v).trim();
    });
    return out;
  }, [draft, byKey]);
  const dirty = Object.keys(changes).length > 0;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const load = useCallback(async () => {
    try {
      const res = await API.get('/admin/settings');
      setSettings(res.data || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Kaydedilmemiş değişiklikle çıkarken sor
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (!dirtyRef.current) return;
    e.preventDefault();
    Alert.alert(t('admin_set_discard_title'), t('admin_set_discard_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('admin_set_discard'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
    ]);
  }), [navigation, t]);

  const set = (key, v) => setDraft(prev => ({ ...prev, [key]: v }));

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await API.put('/admin/settings', changes);
      setSettings(res.data || []);
      setDraft({});
      refreshAppConfig({ force: true });
      Alert.alert(t('success'), t('admin_set_saved'));
    } catch (err) {
      const code = err?.response?.data?.message;
      Alert.alert(t('error'), ERROR_KEYS[code] ? t(ERROR_KEYS[code]) : apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const confirmMaintenance = (on) => {
    if (!on) { set('maintenance.enabled', 'false'); return; }
    Alert.alert(t('admin_set_maint_confirm_title'), t('admin_set_maint_confirm_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('admin_set_maint_confirm_ok'), style: 'destructive', onPress: () => set('maintenance.enabled', 'true') },
    ]);
  };

  const lastChange = (keys) => {
    const rows = keys.map(k => byKey[k]).filter(r => r?.updatedAt);
    if (!rows.length) return null;
    const last = rows.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
    const when = new Date(last.updatedAt).toLocaleString(dateLocale(lang), {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    return t('admin_set_last_change', { who: last.updatedBy || '?', when });
  };

  // ── Parçalar ──────────────────────────────────────────────────────────────
  // Düz fonksiyon (bileşen değil): içindeki alanlar her tuşta yeniden kurulup odağı kaybetmesin
  const section = ({ icon, title, hint, keys, children }) => {
    const footer = keys ? lastChange(keys) : null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name={icon} size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
        <View style={styles.card}>{children}</View>
        {footer ? <Text style={styles.footer}>{footer}</Text> : null}
      </View>
    );
  };

  const switchRow = (key, label, sub, icon, onChange) => (
    <View key={key} style={styles.row}>
      {icon ? <Ionicons name={icon} size={18} color={colors.textSecondary} style={styles.rowIcon} /> : null}
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {key in changes ? <View style={styles.changedDot} /> : null}
      <Switch
        value={isTrue(key)}
        onValueChange={(v) => (onChange ? onChange(v) : set(key, v ? 'true' : 'false'))}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#fff"
        accessibilityLabel={label}
      />
    </View>
  );

  const textField = (key, label, placeholder, multiline = true) => {
    const v = value(key);
    return (
      <View key={key} style={styles.field}>
        <View style={styles.fieldHead}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={[styles.counter, v.length > TEXT_MAX && { color: colors.primary }]}>
            {v.length}/{TEXT_MAX}
          </Text>
        </View>
        <TextInput
          value={v}
          onChangeText={(x) => set(key, x)}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, multiline && styles.inputMulti, key in changes && styles.inputChanged]}
          multiline={multiline}
          maxLength={TEXT_MAX + 20}
          autoCapitalize={multiline ? 'sentences' : 'none'}
          autoCorrect={multiline}
          accessibilityLabel={label}
        />
      </View>
    );
  };

  const numberRow = (key, label) => {
    const s = byKey[key];
    if (!s) return null;
    return (
      <View key={key} style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowSub}>{t('admin_set_range', { min: s.min, max: s.max, def: s.defaultValue })}</Text>
        </View>
        <TextInput
          value={String(value(key))}
          onChangeText={(x) => set(key, x.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          style={[styles.numInput, key in changes && styles.inputChanged]}
          maxLength={4}
          accessibilityLabel={label}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const announcementTone = value('announcement.tone') || 'info';
  const previewText = value(lang === 'en' ? 'announcement.text_en' : 'announcement.text_tr')
    || value('announcement.text_tr') || value('announcement.text_en');
  const toneColor = announcementTone === 'warning' ? colors.secondary
    : announcementTone === 'success' ? colors.accent : colors.primary;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => goBackOrFallback(navigation, 'Admin')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_nav_settings_title')}</Text>
        <TouchableOpacity
          onPress={save}
          disabled={!dirty || saving}
          style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnOff]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !dirty || saving }}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveText}>{t('save')}</Text>}
        </TouchableOpacity>
      </View>

      {error && settings.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('admin_set_load_error')}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.saveText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        >
          {dirty ? (
            <View style={styles.dirtyBar}>
              <Ionicons name="information-circle-outline" size={16} color={colors.secondary} />
              <Text style={styles.dirtyText}>{t('admin_set_unsaved', { count: Object.keys(changes).length })}</Text>
              <TouchableOpacity onPress={() => setDraft({})} hitSlop={8} accessibilityRole="button">
                <Text style={styles.undoText}>{t('admin_set_reset')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {section({
            icon: 'build-outline',
            title: t('admin_set_maint_title'),
            hint: t('admin_set_maint_hint'),
            keys: ['maintenance.enabled', 'maintenance.message_tr', 'maintenance.message_en'],
            children: (
              <>
                {switchRow('maintenance.enabled', t('admin_set_maint_switch'), null, null, confirmMaintenance)}
                {textField('maintenance.message_tr', t('admin_set_msg_tr'), t('maintenance_sub'))}
                {textField('maintenance.message_en', t('admin_set_msg_en'), 'We are doing maintenance…')}
              </>
            ),
          })}

          {section({
            icon: 'megaphone-outline',
            title: t('admin_set_ann_title'),
            hint: t('admin_set_ann_hint'),
            keys: ['announcement.enabled', 'announcement.text_tr', 'announcement.text_en', 'announcement.tone', 'announcement.link'],
            children: (
          <>
            {switchRow('announcement.enabled', t('admin_set_ann_switch'))}
            {textField('announcement.text_tr', t('admin_set_msg_tr'), t('admin_set_ann_placeholder'))}
            {textField('announcement.text_en', t('admin_set_msg_en'), 'Announcement text…')}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('admin_set_tone')}</Text>
              <View style={styles.tones}>
                {TONES.map(([tone, key]) => {
                  const on = announcementTone === tone;
                  return (
                    <TouchableOpacity
                      key={tone}
                      onPress={() => set('announcement.tone', tone)}
                      style={[styles.tone, on && styles.toneOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                    >
                      <Text style={[styles.toneText, on && styles.toneTextOn]}>{t(key)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {textField('announcement.link', t('admin_set_link'), 'concertly://event/123', false)}
            <Text style={styles.linkHint}>{t('admin_set_link_hint')}</Text>
            {previewText ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('admin_set_preview')}</Text>
                <View style={[styles.preview, { borderColor: `${toneColor}66`, backgroundColor: `${toneColor}14` }]}>
                  <Ionicons
                    name={announcementTone === 'warning' ? 'warning-outline' : announcementTone === 'success' ? 'checkmark-circle-outline' : 'megaphone-outline'}
                    size={18}
                    color={toneColor}
                  />
                  <Text style={styles.previewText}>{previewText}</Text>
                </View>
              </View>
            ) : null}
          </>
            ),
          })}

          {section({
            icon: 'toggle-outline',
            title: t('admin_set_features_title'),
            hint: t('admin_set_features_hint'),
            keys: FEATURES.map(f => f[0]),
            children: FEATURES.map(([key, label, icon]) => switchRow(key, t(label), t(`${label}_sub`), icon)),
          })}

          {section({
            icon: 'speedometer-outline',
            title: t('admin_set_limits_title'),
            hint: t('admin_set_limits_hint'),
            keys: LIMITS.map(l => l[0]),
            children: LIMITS.map(([key, label]) => numberRow(key, t(label))),
          })}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 14, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
    saveBtn: {
      minWidth: 72, alignItems: 'center', backgroundColor: colors.primary,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    },
    saveBtnOff: { opacity: 0.4 },
    saveText: { color: '#fff', fontWeight: '700' },
    retryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
    emptyText: { fontSize: 15, color: colors.textSecondary },

    content: { padding: 16, gap: 22 },
    dirtyBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: `${colors.secondary}1A`, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    },
    dirtyText: { flex: 1, color: colors.text, fontSize: 13 },
    undoText: { color: colors.secondary, fontWeight: '700', fontSize: 13 },

    section: { gap: 8 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.text },
    sectionHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
    card: {
      backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 4,
    },
    footer: { fontSize: 11, color: colors.textSecondary, marginLeft: 4 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    rowIcon: { width: 20 },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
    changedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },

    field: { paddingVertical: 10, gap: 6 },
    fieldHead: { flexDirection: 'row', justifyContent: 'space-between' },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    counter: { fontSize: 11, color: colors.textSecondary },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background,
      color: colors.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10,
    },
    inputMulti: { minHeight: 64, textAlignVertical: 'top' },
    inputChanged: { borderColor: colors.secondary },
    numInput: {
      width: 72, textAlign: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      backgroundColor: colors.background, color: colors.text, fontSize: 15, fontWeight: '700', paddingVertical: 8,
    },
    linkHint: { fontSize: 11, color: colors.textSecondary, marginTop: -4, marginBottom: 6, lineHeight: 15 },

    tones: { flexDirection: 'row', gap: 8 },
    tone: {
      flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      paddingVertical: 8, backgroundColor: colors.background,
    },
    toneOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    toneText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
    toneTextOn: { color: '#fff' },

    preview: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    },
    previewText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  });
}
