//register screen - kullanıcı adı, email, şifre ile kayıt olma
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: 'center', padding: 24 },
    logoArea: { alignItems: 'center', marginBottom: 48 },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 36, fontWeight: 'bold', color: colors.text, letterSpacing: 2 },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },
    form: { gap: 12 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
    },
    button: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    linkArea: { alignItems: 'center', marginTop: 16 },
    link: { color: colors.textSecondary, fontSize: 14 },
    linkBold: { color: colors.secondary, fontWeight: 'bold' },
    agreeText: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },
    agreeLink: { color: colors.secondary, fontWeight: '600' },
  });
}

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { login } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert(t('error'), t('reg_fill_all'));
      return;
    }
    setLoading(true);
    try {
      await API.post('/auth/register', { username, email, password });
      const loginRes = await API.post('/auth/login', { email, password });
      await login({ ...loginRes.data, onboardingCompleted: false });
      navigation.replace('GenreSelection');
    } catch (err) {
      Alert.alert(t('error'), t('reg_already_exists'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.background, colors.card, colors.cardAlt]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>

        <View style={styles.logoArea}>
          <Text style={styles.emoji}>🎟️</Text>
          <Text style={styles.title}>{t('reg_title')}</Text>
          <Text style={styles.subtitle}>{t('reg_subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('reg_username')}
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder={t('password')}
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
          ) : (
            <TouchableOpacity onPress={handleRegister}>
              <LinearGradient colors={['#F5A623', '#E94560']} style={styles.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>{t('reg_btn')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkArea}>
            <Text style={styles.link}>{t('reg_have_account')} <Text style={styles.linkBold}>{t('reg_login_link')}</Text></Text>
          </TouchableOpacity>

          <Text style={styles.agreeText}>
            {t('reg_agree_prefix')}
            <Text style={styles.agreeLink} onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>
              {t('settings_terms')}
            </Text>
            {t('reg_agree_and')}
            <Text style={styles.agreeLink} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>
              {t('settings_privacy_policy')}
            </Text>
            {t('reg_agree_suffix')}
          </Text>
        </View>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}