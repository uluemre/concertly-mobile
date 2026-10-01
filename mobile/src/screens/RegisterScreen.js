//register screen - kullanıcı adı, email, şifre ile kayıt olma
import React, { useRef, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { isValidUsername, normalizeUsername } from '../utils/username';
import { isValidEmail, normalizeEmail } from '../utils/email';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';

// Sunucudaki AuthService.register ile aynı şifre kuralı
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;   // BCrypt 72 baytın ötesini yok sayar

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  // Yalnız sunum: Alert mesajı ayrıca ilgili alanın altında da gösterilir
  const [errors, setErrors] = useState({});
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const fail = (field, key) => {
    const message = t(key);
    setErrors({ [field]: message });
    Alert.alert(t('error'), message);
  };

  const handleRegister = async () => {
    if (loading) return;
    setErrors({});
    if (!username || !email || !password || !passwordConfirm) {
      const message = t('reg_fill_all');
      setErrors({
        username: !username ? message : undefined,
        email: !email ? message : undefined,
        password: !password ? message : undefined,
        passwordConfirm: !passwordConfirm ? message : undefined,
      });
      Alert.alert(t('error'), message);
      return;
    }
    // Kullanıcı adı kuralı sunucuyla aynı (N-21)
    if (!isValidUsername(username)) {
      fail('username', 'username_rule');
      return;
    }
    // E-posta kuralı sunucuyla aynı (N-22)
    if (!isValidEmail(email)) {
      fail('email', 'email_invalid');
      return;
    }
    // Şifre kuralı sunucuyla aynı (N-20): en az 6 karakter (yalnızca boşluk sayılmaz), en fazla 72
    if (password.trim().length < PASSWORD_MIN) {
      fail('password', 'reset_password_too_short');
      return;
    }
    if (password.length > PASSWORD_MAX) {
      fail('password', 'reg_password_too_long');
      return;
    }
    if (password !== passwordConfirm) {
      fail('passwordConfirm', 'reset_passwords_mismatch');
      return;
    }
    setLoading(true);
    try {
      const cleanEmail = normalizeEmail(email);
      const res = await API.post('/auth/register', { username: normalizeUsername(username), email: cleanEmail, password });
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
      // 400'ün tek sebebi kısa şifre değil: sunucunun gerekçesini göster
      const message = status === 409 ? t('reg_already_exists')
        : status === 400 ? (err?.response?.data?.message || t('reset_password_too_short'))
        : t('verify_network_error');
      if (status === 409) setErrors({ email: message });
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => setErrors(e => (e[field] ? { ...e, [field]: undefined } : e));

  return (
    <AuthLayout
      icon="person-add-outline"
      title={t('reg_title')}
      subtitle={t('reg_subtitle')}
      footer={(
        <>
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
        </>
      )}
    >
      <AuthInput
        label={t('reg_username')}
        icon="person-outline"
        placeholder={t('reg_username')}
        value={username}
        onChangeText={(v) => { setUsername(v); clearError('username'); }}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        autoComplete="username-new"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        blurOnSubmit={false}
        hint={t('username_rule')}
        error={errors.username}
      />
      <AuthInput
        ref={emailRef}
        label={t('email')}
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
        onSubmitEditing={() => passwordRef.current?.focus()}
        blurOnSubmit={false}
        error={errors.email}
      />
      <AuthInput
        ref={passwordRef}
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
        onSubmitEditing={handleRegister}
        error={errors.passwordConfirm}
      />

      <AuthButton title={t('reg_btn')} onPress={handleRegister} loading={loading} style={styles.submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  submit: { marginTop: 6 },
  switchRow: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  switchText: { fontSize: 14, textAlign: 'center' },
  switchLink: { fontWeight: '700' },
  agreeText: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18, paddingHorizontal: 8 },
  agreeLink: { fontWeight: '600' },
});
