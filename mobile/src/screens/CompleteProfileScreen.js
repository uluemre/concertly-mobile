// Profilini tamamla — ad soyad / doğum tarihi olmadan açılmış eski hesaplara bir kez sorulur.
// Kaydedilmeden uygulamaya geçilmez (AppNavigator yönlendirir). Doğum tarihi bir kez yazılır.
import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, View } from 'react-native';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  isValidFullName, normalizeFullName, parseBirthDate, isoToBirthInput, profileErrorKey,
} from '../utils/profileInfo';
import postAuthRoute from '../navigation/postAuthRoute';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import BirthDateInput from '../components/auth/BirthDateInput';

export default function CompleteProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const { session, updateSession, logout } = useAuth();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [birth, setBirth] = useState('');
  const [birthLocked, setBirthLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const birthRef = useRef(null);

  // Yarım kalan bilgi (yalnız ad ya da yalnız tarih) doldurulmuş gelir
  useEffect(() => {
    API.get('/users/me/basic-info')
      .then(({ data }) => {
        if (data?.fullName) setFullName(data.fullName);
        if (data?.birthDate) { setBirth(isoToBirthInput(data.birthDate)); setBirthLocked(true); }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const clearError = (field) => setErrors(e => (e[field] ? { ...e, [field]: undefined } : e));

  const handleSave = async () => {
    if (saving) return;
    if (!isValidFullName(fullName)) {
      setErrors({ fullName: t('reg_name_invalid') });
      return;
    }
    const parsed = birthLocked ? {} : parseBirthDate(birth);
    if (parsed.error) {
      setErrors({ birth: t(parsed.error) });
      return;
    }
    setSaving(true);
    try {
      const res = await API.put('/users/me/basic-info', {
        fullName: normalizeFullName(fullName),
        ...(birthLocked ? {} : { birthDate: parsed.iso }),
      });
      const next = { ...session, profileComplete: !!res.data?.profileComplete, fullName: res.data?.fullName || '' };
      await updateSession({ profileComplete: next.profileComplete, fullName: next.fullName });
      navigation.reset({ index: 0, routes: [{ name: postAuthRoute(next) }] });
    } catch (err) {
      const key = profileErrorKey(err?.response?.data?.message);
      if (key === 'reg_underage') {
        // 18 yaş altı: uygulama kullanılamaz; çıkış teklif edilir
        Alert.alert(t('complete_underage_title'), t('reg_underage'), [
          { text: t('confirm'), style: 'cancel' },
          { text: t('profile_logout'), style: 'destructive', onPress: () => logout() },
        ]);
      } else if (key) {
        setErrors(key === 'reg_name_invalid' ? { fullName: t(key) } : { birth: t(key) });
      } else {
        Alert.alert(t('error'), t('verify_network_error'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthLayout
      icon="person-circle-outline"
      bottomOffset={90}
      title={t('complete_title')}
      subtitle={t('complete_subtitle')}
      footer={(
        <TouchableOpacity onPress={() => logout()} style={styles.logoutRow} accessibilityRole="button">
          <Text style={[styles.logoutText, { color: colors.textSecondary }]}>{t('profile_logout')}</Text>
        </TouchableOpacity>
      )}
    >
      <AuthInput
        label={t('reg_full_name')}
        icon="person-outline"
        placeholder={t('reg_name_placeholder')}
        value={fullName}
        onChangeText={(v) => { setFullName(v); clearError('fullName'); }}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="name"
        autoComplete="name"
        maxLength={60}
        returnKeyType="next"
        onSubmitEditing={() => (birthLocked ? handleSave() : birthRef.current?.focus())}
        blurOnSubmit={birthLocked}
        error={errors.fullName}
      />
      <BirthDateInput
        ref={birthRef}
        label={t('reg_birth_label')}
        value={birth}
        onChangeText={(v) => { setBirth(v); clearError('birth'); }}
        editable={!birthLocked}
        error={errors.birth}
      />
      <AuthButton title={t('save')} onPress={handleSave} loading={saving} style={styles.submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  submit: { marginTop: 6 },
  logoutRow: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  logoutText: { fontSize: 14, textAlign: 'center' },
});
