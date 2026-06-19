import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API, { getErrorMessage } from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

export default function ChangePasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (saving) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('error'), t('change_pw_fill'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('error'), t('change_pw_short'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), t('change_pw_mismatch'));
      return;
    }
    setSaving(true);
    try {
      await API.put('/auth/change-password', { currentPassword, newPassword });
      Alert.alert(t('change_pw_title'), t('change_pw_success'), [
        { text: t('confirm'), onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert(t('error'), getErrorMessage(err, t('change_pw_error')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('change_pw_title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('change_pw_current')}</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('change_pw_new')}</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('change_pw_confirm')}</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
            <LinearGradient
              colors={['#E94560', '#7C3AED']}
              style={styles.saveButton}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveButtonText}>{t('change_pw_btn')}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backButton: { width: 60 },
    backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    scrollContent: { padding: 20, paddingBottom: 60 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: '600' },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 14, color: colors.text, fontSize: 15,
    },
    saveButton: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 12 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  });
}
