import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image
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
    logo: {
      width: 100,
      height: 100,
      marginBottom: 16,
    },
    title: {
      fontSize: 36, fontWeight: 'bold',
      color: colors.text, letterSpacing: 2,
    },
    subtitle: {
      fontSize: 14, color: colors.textSecondary, marginTop: 6,
    },

    form: { gap: 12 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 16,
      fontSize: 16, color: colors.text,
    },
    button: {
      padding: 16, borderRadius: 12,
      alignItems: 'center', marginTop: 8,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    linkArea: { alignItems: 'center', marginTop: 16 },
    link: { color: colors.textSecondary, fontSize: 14 },
    linkBold: { color: colors.primary, fontWeight: 'bold' },

  });
}

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('error'), t('login_empty_error'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      await login(res.data);
      if (res.data.isAdmin) {
        navigation.replace('Admin');
      } else {
        navigation.replace('MainApp');
      }
    } catch (err) {
      Alert.alert(t('error'), t('login_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.background, colors.card, colors.cardAlt]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* LOGO ALANI */}
        <View style={styles.logoArea}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('login_title')}</Text>
          <Text style={styles.subtitle}>{t('login_subtitle')}</Text>

        </View>

        {/* FORM */}
        <View style={styles.form}>
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
            placeholder="Şifre"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{ marginTop: 16 }}
            />
          ) : (
            <TouchableOpacity onPress={handleLogin}>
              <LinearGradient
                colors={['#E94560', '#7C3AED']}
                style={styles.button}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>{t('login_btn')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.linkArea}
          >
            <Text style={[styles.link, { textAlign: 'center' }]}>
              <Text style={styles.linkBold}>{t('forgot_link')}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.linkArea}
          >
            <Text style={styles.link}>
              {t('login_no_account')}{' '}
              <Text style={styles.linkBold}>{t('login_register_link')}</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
