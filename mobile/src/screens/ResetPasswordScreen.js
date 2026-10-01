import React, { useRef, useState } from 'react';
import { Text, StyleSheet, Alert } from 'react-native';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { goBackOrFallback } from '../navigation/navHelpers';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';

export default function ResetPasswordScreen({ navigation, route }) {
  const { email } = route.params ?? {};
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  // Yalnız sunum: Alert mesajı ayrıca ilgili alanın altında da gösterilir
  const [errors, setErrors] = useState({});
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const fail = (field, key) => {
    const message = t(key);
    setErrors({ [field]: message });
    Alert.alert(t('error'), message);
  };

  const handleReset = async () => {
    if (loading) return;
    setErrors({});
    if (!token.trim() || !newPassword || !confirm) {
      const message = t('reset_fields_required');
      setErrors({
        token: !token.trim() ? message : undefined,
        newPassword: !newPassword ? message : undefined,
        confirm: !confirm ? message : undefined,
      });
      Alert.alert(t('error'), message);
      return;
    }
    if (newPassword !== confirm) {
      fail('confirm', 'reset_passwords_mismatch');
      return;
    }
    if (newPassword.length < 6) {
      fail('newPassword', 'reset_password_too_short');
      return;
    }
    setLoading(true);
    try {
      await API.post('/auth/reset-password', { email, token: token.trim(), newPassword });
      Alert.alert(t('reset_success_title'), t('reset_success_sub'), [
        { text: t('ok'), onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      const reason = err?.response?.data?.message;
      const key = reason === 'SAME_PASSWORD' ? 'password_same_as_old'
        : reason === 'CODE_ATTEMPTS_EXCEEDED' ? 'reset_too_many_attempts'
        : reason === 'CODE_EXPIRED' ? 'reset_code_expired'
        : reason === 'TOO_MANY_REQUESTS' ? 'auth_too_many'
        : 'reset_invalid_token';
      setErrors(reason === 'SAME_PASSWORD' ? { newPassword: t(key) } : { token: t(key) });
      Alert.alert(t('error'), t(key));
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => setErrors(e => (e[field] ? { ...e, [field]: undefined } : e));

  return (
    <AuthLayout
      icon="shield-checkmark-outline"
      title={t('reset_title')}
      subtitle={(
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('reset_subtitle')}{' '}
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{email}</Text>
        </Text>
      )}
      onBack={() => goBackOrFallback(navigation, 'Login')}
      backLabel={t('back')}
    >
      <AuthInput
        label={t('reset_code_placeholder')}
        icon="keypad-outline"
        placeholder={t('reset_code_placeholder')}
        value={token}
        onChangeText={(v) => { setToken(v); clearError('token'); }}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        blurOnSubmit={false}
        error={errors.token}
      />
      <AuthInput
        ref={passwordRef}
        label={t('reset_new_password')}
        icon="lock-closed-outline"
        placeholder={t('reset_new_password')}
        value={newPassword}
        onChangeText={(v) => { setNewPassword(v); clearError('newPassword'); }}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="password-new"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        blurOnSubmit={false}
        // Register ile aynı kural metni (aynı anahtar); hata varken yerini hata alır
        hint={t('reg_password_rule')}
        error={errors.newPassword}
      />
      <AuthInput
        ref={confirmRef}
        label={t('reset_confirm_password')}
        icon="lock-closed-outline"
        placeholder={t('reset_confirm_password')}
        value={confirm}
        onChangeText={(v) => { setConfirm(v); clearError('confirm'); }}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="password-new"
        returnKeyType="go"
        onSubmitEditing={handleReset}
        error={errors.confirm}
      />

      <AuthButton title={t('reset_btn')} onPress={handleReset} loading={loading} style={styles.submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  submit: { marginTop: 6 },
});
