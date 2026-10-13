// Kayıt — Instagram gibi adım adım: ad soyad → doğum tarihi (18+) → e-posta → kullanıcı adı → şifre.
// Her adım kendi alanını doğrular; sunucu hatası ilgili adıma geri döndürür.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useAppConfig } from '../context/AppConfigContext';
import { isValidUsername, normalizeUsername } from '../utils/username';
import { isValidEmail, normalizeEmail } from '../utils/email';
import { isValidFullName, normalizeFullName, parseBirthDate, profileErrorKey } from '../utils/profileInfo';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import BirthDateInput from '../components/auth/BirthDateInput';

// Sunucudaki AuthService.register ile aynı şifre kuralı
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;   // BCrypt 72 baytın ötesini yok sayar

const STEPS = [
  { key: 'name', icon: 'person-outline' },
  { key: 'birth', icon: 'calendar-outline' },
  { key: 'email', icon: 'mail-outline' },
  { key: 'username', icon: 'at-outline' },
  { key: 'password', icon: 'lock-closed-outline' },
];
const LAST = STEPS.length - 1;

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const { login } = useAuth();
  const { t } = useLanguage();
  const { isOn } = useAppConfig();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [forward, setForward] = useState(true);   // giriş animasyonunun yönü
  const [fullName, setFullName] = useState('');
  const [birth, setBirth] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const confirmRef = useRef(null);

  const goTo = (next) => {
    setForward(next > step);
    setErrors({});
    setStep(next);
  };

  // Geri (iOS kaydırma, Android geri tuşu) önceki adıma döner; ilk adımda ekrandan çıkar.
  // Kayıt sonrası replace/reset engellenmez.
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    const type = e.data.action.type;
    if (stepRef.current === 0 || (type !== 'GO_BACK' && type !== 'POP')) return;
    e.preventDefault();
    setForward(false);
    setErrors({});
    setStep(s => s - 1);
  }), [navigation]);

  // iOS'un kenardan geri kaydırması native: beforeRemove onu durduramaz, ekrandan çıkarırdı.
  // İlk adımdan sonra kapatılır; yerine içerikte sağa kaydırma önceki adıma döner.
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: step === 0 });
  }, [navigation, step]);
  // Yalnız belirgin sağa hareket; dikey kaydırma (failOffsetY) ve dokunuşlar etkilenmez
  const swipeBack = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(20)
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (e.translationX > 60 && stepRef.current > 0) {
        setForward(false);
        setErrors({});
        setStep(s => s - 1);
      }
    }), []);

  const fail = (field, key) => setErrors({ [field]: t(key) });

  // Bu adımın alanı geçerliyse true
  const validateStep = () => {
    switch (STEPS[step].key) {
      case 'name':
        if (!isValidFullName(fullName)) { fail('fullName', 'reg_name_invalid'); return false; }
        return true;
      case 'birth': {
        const parsed = parseBirthDate(birth);
        if (parsed.error) { fail('birth', parsed.error); return false; }
        return true;
      }
      case 'email':
        if (!isValidEmail(email)) { fail('email', 'email_invalid'); return false; }
        return true;
      case 'username':
        // Kullanıcı adı kuralı sunucuyla aynı (N-21)
        if (!isValidUsername(username)) { fail('username', 'username_rule'); return false; }
        return true;
      case 'password':
        // Şifre kuralı sunucuyla aynı (N-20): en az 6 karakter (yalnızca boşluk sayılmaz), en fazla 72
        if (password.trim().length < PASSWORD_MIN) { fail('password', 'reset_password_too_short'); return false; }
        if (password.length > PASSWORD_MAX) { fail('password', 'reg_password_too_long'); return false; }
        if (password !== passwordConfirm) { fail('passwordConfirm', 'reset_passwords_mismatch'); return false; }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (loading || !validateStep()) return;
    if (step < LAST) goTo(step + 1);
    else handleRegister();
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const cleanEmail = normalizeEmail(email);
      const res = await API.post('/auth/register', {
        username: normalizeUsername(username),
        email: cleanEmail,
        password,
        fullName: normalizeFullName(fullName),
        birthDate: parseBirthDate(birth).iso,
      });
      if (res.data?.emailVerificationRequired) {
        // Hesap, e-postaya giden kod girilene kadar açılmaz
        navigation.replace('VerifyEmail', { email: cleanEmail });
        return;
      }
      const loginRes = await API.post('/auth/login', { email: cleanEmail, password });
      await login({ ...loginRes.data, onboardingCompleted: false });
      navigation.replace('GenreSelection');
    } catch (err) {
      const status = err?.response?.status;
      const reason = err?.response?.data?.message || '';
      // Sunucu hatası ilgili adıma geri götürür
      const backTo = (key, field, message) => {
        const index = STEPS.findIndex(s => s.key === key);
        setForward(false);
        setStep(index);
        setErrors({ [field]: message });
      };
      if (status === 403 && reason === 'REGISTRATION_CLOSED') {
        Alert.alert(t('reg_closed_title'), t('reg_closed_sub'));
      } else if (status === 409) {
        const usernameTaken = /kullanıcı adı|username/i.test(reason);
        backTo(usernameTaken ? 'username' : 'email', usernameTaken ? 'username' : 'email',
          t(usernameTaken ? 'reg_username_taken' : 'reg_email_taken'));
      } else if (status === 400 && profileErrorKey(reason)) {
        const nameError = reason === 'FULL_NAME_INVALID';
        backTo(nameError ? 'name' : 'birth', nameError ? 'fullName' : 'birth', t(profileErrorKey(reason)));
      } else {
        // 400'ün tek sebebi kısa şifre değil: sunucunun gerekçesini göster
        const message = status === 400 ? (reason || t('reset_password_too_short'))
          : status === 429 ? t('auth_too_many')
          : t('verify_network_error');
        Alert.alert(t('error'), message);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => setErrors(e => (e[field] ? { ...e, [field]: undefined } : e));
  const key = STEPS[step].key;

  const renderField = () => {
    switch (key) {
      case 'name':
        return (
          <AuthInput
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
            onSubmitEditing={handleNext}
            autoFocus
            error={errors.fullName}
          />
        );
      case 'birth':
        return (
          <BirthDateInput
            value={birth}
            onChangeText={(v) => { setBirth(v); clearError('birth'); }}
            autoFocus
            error={errors.birth}
          />
        );
      case 'email':
        return (
          <AuthInput
            icon="mail-outline"
            placeholder={t('forgot_email_placeholder')}
            value={email}
            onChangeText={(v) => { setEmail(v); clearError('email'); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={handleNext}
            autoFocus
            error={errors.email}
          />
        );
      case 'username':
        return (
          <AuthInput
            icon="at-outline"
            placeholder={t('reg_username')}
            value={username}
            onChangeText={(v) => { setUsername(v); clearError('username'); }}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            autoComplete="username-new"
            returnKeyType="next"
            onSubmitEditing={handleNext}
            autoFocus
            hint={t('username_rule')}
            error={errors.username}
          />
        );
      default:
        return (
          <>
            <AuthInput
              label={t('password')}
              icon="lock-closed-outline"
              placeholder={t('password')}
              value={password}
              onChangeText={(v) => { setPassword(v); clearError('password'); }}
              secure
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              blurOnSubmit={false}
              autoFocus
              hint={t('reg_password_rule')}
              error={errors.password}
            />
            <AuthInput
              ref={confirmRef}
              label={t('reg_password_confirm')}
              icon="lock-closed-outline"
              placeholder={t('reg_password_confirm')}
              value={passwordConfirm}
              onChangeText={(v) => { setPasswordConfirm(v); clearError('passwordConfirm'); }}
              secure
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="go"
              onSubmitEditing={handleNext}
              error={errors.passwordConfirm}
            />
          </>
        );
    }
  };

  const progress = (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack} accessible accessibilityLabel={t('reg_step_of', { n: step + 1, total: STEPS.length })}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{t('reg_step_of', { n: step + 1, total: STEPS.length })}</Text>
    </View>
  );

  // Admin yeni kayıtları kapattıysa form yerine bilgi gösterilir
  if (!isOn('registration')) {
    const leave = () => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login'));
    return (
      <AuthLayout icon="lock-closed-outline" title={t('reg_closed_title')} subtitle={t('reg_closed_sub')} onBack={leave}>
        <AuthButton title={t('reg_closed_back')} onPress={leave} style={styles.submit} />
      </AuthLayout>
    );
  }

  return (
    <GestureDetector gesture={swipeBack}>
    <View style={styles.flex}>
    <AuthLayout
      icon={STEPS[step].icon}
      // Klavye açıkken alanın altındaki İleri düğmesi de görünsün
      bottomOffset={step === LAST ? 90 : 110}
      title={t(`reg_step_${key}_title`)}
      subtitle={t(`reg_step_${key}_subtitle`)}
      top={progress}
      onBack={() => (step > 0 ? goTo(step - 1) : navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login'))}
      backLabel={t('a11y_back')}
      footer={step === 0 ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.switchRow}
          accessibilityRole="button"
          accessibilityLabel={`${t('reg_have_account')} ${t('reg_login_link')}`}
        >
          <Text style={[styles.switchText, { color: colors.textSecondary }]}>
            {t('reg_have_account')}{' '}
            <Text style={[styles.switchLink, { color: colors.primary }]}>{t('reg_login_link')}</Text>
          </Text>
        </TouchableOpacity>
      ) : step === LAST ? (
        <Text style={[styles.agreeText, { color: colors.textSecondary }]}>
          {t('reg_agree_prefix')}
          <Text
            style={[styles.agreeLink, { color: colors.primary }]}
            onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
            accessibilityRole="link"
          >
            {t('settings_terms')}
          </Text>
          {t('reg_agree_and')}
          <Text
            style={[styles.agreeLink, { color: colors.primary }]}
            onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
            accessibilityRole="link"
          >
            {t('settings_privacy_policy')}
          </Text>
          {t('reg_agree_suffix')}
        </Text>
      ) : null}
    >
      <Animated.View key={key} entering={(forward ? FadeInRight : FadeInLeft).duration(220)}>
        {renderField()}
      </Animated.View>

      <AuthButton
        title={step === LAST ? t('reg_btn') : t('reg_next')}
        onPress={handleNext}
        loading={loading}
        style={styles.submit}
      />
    </AuthLayout>
    </View>
    </GestureDetector>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    submit: { marginTop: 6 },
    progressWrap: { marginBottom: 24 },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
    progressText: { fontSize: 12, color: colors.textSecondary, marginTop: 8, textAlign: 'right' },
    switchRow: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
    switchText: { fontSize: 14, textAlign: 'center' },
    switchLink: { fontWeight: '700' },
    agreeText: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18, paddingHorizontal: 8 },
    agreeLink: { fontWeight: '600' },
  });
}
