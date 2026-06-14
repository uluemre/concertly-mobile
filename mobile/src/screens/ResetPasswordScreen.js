import React, { useState, useMemo } from 'react';
import {
  Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

export default function ResetPasswordScreen({ navigation, route }) {
  const { email } = route.params ?? {};
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!token.trim() || !newPassword || !confirm) {
      Alert.alert(t('error'), t('reset_fields_required'));
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert(t('error'), t('reset_passwords_mismatch'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('error'), t('reset_password_too_short'));
      return;
    }
    setLoading(true);
    try {
      await API.post('/auth/reset-password', { email, token: token.trim(), newPassword });
      Alert.alert(t('reset_success_title'), t('reset_success_sub'), [
        { text: t('ok'), onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert(t('error'), t('reset_invalid_token'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0A0A14', '#1a0a2e', '#0A0A14']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ {t('back')}</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>🔐 {t('reset_title')}</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {t('reset_subtitle')} <Text style={{ color: colors.primary }}>{email}</Text>
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder={t('reset_code_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={token}
          onChangeText={setToken}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder={t('reset_new_password')}
          placeholderTextColor={colors.textSecondary}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder={t('reset_confirm_password')}
          placeholderTextColor={colors.textSecondary}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <TouchableOpacity onPress={handleReset} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#7C3AED', '#E94560']} style={styles.btn}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('reset_btn')}</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, padding: 24, justifyContent: 'center' },
    back: { position: 'absolute', top: 56, left: 24 },
    backText: { fontSize: 16, fontWeight: '700' },
    title: { fontSize: 28, fontWeight: '900', marginBottom: 8, marginTop: 60 },
    sub: { fontSize: 14, lineHeight: 20, marginBottom: 32 },
    input: {
      borderRadius: 16, padding: 16, fontSize: 16,
      borderWidth: 1, marginBottom: 14,
    },
    btn: { borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 8 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}
