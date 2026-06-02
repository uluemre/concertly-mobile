import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import API from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';

export default function CreatePostScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useLanguage();
  const { event } = route.params;

  const POST_TYPES = useMemo(() => [
    { key: 'TEXT', label: t('post_type_text') },
    { key: 'IMAGE', label: t('post_type_image') },
    { key: 'POLL', label: t('post_type_poll') },
  ], [t]);

  const [postType, setPostType] = useState('TEXT');
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('post_perm_title'), t('post_perm_msg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const updatePollOption = (text, index) => {
    const updated = [...pollOptions];
    updated[index] = text;
    setPollOptions(updated);
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions([...pollOptions, '']);
  };

  const removePollOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const handlePost = async () => {
    if (!content.trim() && postType !== 'IMAGE') {
      Alert.alert(t('error'), t('post_empty_content'));
      return;
    }
    if (postType === 'IMAGE' && !imageUri) {
      Alert.alert(t('error'), t('post_no_image'));
      return;
    }
    if (postType === 'POLL') {
      const filled = pollOptions.filter(o => o.trim().length > 0);
      if (filled.length < 2) {
        Alert.alert(t('error'), t('post_poll_min'));
        return;
      }
    }

    setLoading(true);
    try {
      await API.post('/posts', {
        eventId: event.id,
        content: content.trim(),
        postType,
        imageUrl: postType === 'IMAGE' ? imageUri : undefined,
        pollOptions: postType === 'POLL' ? pollOptions.filter(o => o.trim()) : undefined,
      });
      Alert.alert(t('post_success_title'), t('post_success_msg'), [
        { text: t('confirm'), onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      Alert.alert(t('error'), t('post_error_msg'));
      console.log(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.container}>
        {/* HEADER */}
        <LinearGradient colors={['#E94560', '#7C3AED']} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{t('post_cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('post_header')}</Text>
          <Text style={styles.headerSub}>{event.name}</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* TÜR SEÇİCİ */}
          <View style={styles.typeRow}>
            {POST_TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, postType === t.key && styles.typeBtnActive]}
                onPress={() => setPostType(t.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeBtnText, postType === t.key && styles.typeBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ETKİNLİK KARTI */}
          <View style={styles.eventCard}>
            <Text style={styles.eventCardLabel}>{t('post_event_label')}</Text>
            <Text style={styles.eventCardName}>{event.name}</Text>
            {event.artistName && <Text style={styles.eventCardSub}>🎤 {event.artistName}</Text>}
            {event.venueCity && <Text style={styles.eventCardSub}>📍 {event.venueCity}</Text>}
          </View>

          {/* YAZI ALANI */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>
              {postType === 'POLL' ? t('post_poll_label') : t('post_question_label')}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={postType === 'POLL' ? t('post_poll_placeholder') : t('post_text_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{content.length}/500</Text>
          </View>

          {/* FOTOĞRAF */}
          {postType === 'IMAGE' && (
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              ) : (
                <View style={styles.imagePickerEmpty}>
                  <Text style={styles.imagePickerEmoji}>📷</Text>
                  <Text style={styles.imagePickerText}>{t('post_pick_photo')}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* ANKET SEÇENEKLERİ */}
          {postType === 'POLL' && (
            <View style={styles.pollSection}>
              {pollOptions.map((opt, i) => (
                <View key={i} style={styles.pollOptionRow}>
                  <TextInput
                    style={styles.pollInput}
                    placeholder={t('post_option_placeholder', { n: i + 1 })}
                    placeholderTextColor={colors.textSecondary}
                    value={opt}
                    onChangeText={text => updatePollOption(text, i)}
                    maxLength={80}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity onPress={() => removePollOption(i)} style={styles.pollRemove}>
                      <Text style={styles.pollRemoveText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < 4 && (
                <TouchableOpacity style={styles.addOptionBtn} onPress={addPollOption}>
                  <Text style={styles.addOptionText}>{t('post_add_option')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* EMOJİ KISAYOLLARI (sadece metin/fotoğraf için) */}
          {postType !== 'POLL' && (
            <View style={styles.emojiRow}>
              {['🔥', '🎸', '🎤', '💥', '❤️', '🙌', '😭', '🤩'].map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => setContent(prev => prev + emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* PAYLAŞ */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <TouchableOpacity onPress={handlePost} style={{ marginTop: 24 }}>
              <LinearGradient
                colors={['#F5A623', '#E94560']}
                style={styles.submitButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.submitText}>{t('post_share')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24 },
    backButton: { marginBottom: 16 },
    backText: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

    content: { padding: 16, gap: 14 },

    typeRow: { flexDirection: 'row', gap: 8 },
    typeBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    typeBtnActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
    typeBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    typeBtnTextActive: { color: colors.primary },

    eventCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    eventCardLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
    eventCardName: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    eventCardSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

    inputCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    inputLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 10, fontWeight: '600' },
    textInput: { color: colors.text, fontSize: 15, minHeight: 100, lineHeight: 22 },
    charCount: { textAlign: 'right', color: colors.textSecondary, fontSize: 12, marginTop: 8 },

    imagePicker: {
      borderRadius: 16, overflow: 'hidden', borderWidth: 1,
      borderColor: colors.border, minHeight: 180,
    },
    imagePreview: { width: '100%', height: 220 },
    imagePickerEmpty: {
      minHeight: 180, backgroundColor: colors.card,
      justifyContent: 'center', alignItems: 'center', gap: 8,
    },
    imagePickerEmoji: { fontSize: 40 },
    imagePickerText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },

    pollSection: { gap: 10 },
    pollOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pollInput: {
      flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 14,
      color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border,
    },
    pollRemove: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    pollRemoveText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    addOptionBtn: {
      padding: 12, borderRadius: 12, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    },
    addOptionText: { color: colors.primary, fontSize: 14, fontWeight: '700' },

    emojiRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    emojiBtn: {
      backgroundColor: colors.card, borderRadius: 12, padding: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    emojiText: { fontSize: 20 },

    submitButton: { padding: 18, borderRadius: 16, alignItems: 'center' },
    submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  });
}
