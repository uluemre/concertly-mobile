import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator,
  Alert, Platform, Image
} from 'react-native';
import { KeyboardAwareScrollView } from '../components/keyboard';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import API, { uploadImage } from '../services/api';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { apiErrorMessage } from '../utils/communityErrors';
import { goBackOrFallback } from '../navigation/navHelpers';

export default function CreatePostScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useLanguage();
  // event opsiyonel: varsa konser postu, yoksa genel paylaşım
  const { event } = route.params || {};

  const POST_TYPES = useMemo(() => [
    { key: 'TEXT', icon: 'create-outline', label: t('post_type_text') },
    { key: 'IMAGE', icon: 'image-outline', label: t('post_type_image') },
    { key: 'POLL', icon: 'stats-chart-outline', label: t('post_type_poll') },
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
      // Fotoğraf önce sunucuya yüklenir — cihazdaki yerel yol başka
      // telefonlardan erişilemez, sunucu yolu herkes için çalışır
      let serverImageUrl;
      if (postType === 'IMAGE' && imageUri) {
        serverImageUrl = await uploadImage(imageUri);
      }

      await API.post('/posts', {
        eventId: event ? event.id : null,
        content: content.trim(),
        postType,
        imageUrl: serverImageUrl,
        pollOptions: postType === 'POLL' ? pollOptions.filter(o => o.trim()) : undefined,
      });
      Alert.alert(t('post_success_title'), t('post_success_msg'), [
        { text: t('confirm'), onPress: () => goBackOrFallback(navigation) }
      ]);
    } catch (err) {
      Alert.alert(t('error'), apiErrorMessage(err, t, 'post_error_msg'));
      console.log(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => goBackOrFallback(navigation)} accessibilityRole="button">
            <Text style={styles.backText}>{t('post_cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('post_header')}</Text>
          <Text style={styles.headerSub}>{event ? event.name : t('post_general_sub')}</Text>
        </View>

        <View style={styles.content}>
          {/* TÜR SEÇİCİ */}
          <View style={styles.typeRow}>
            {POST_TYPES.map(pt => (
              <TouchableOpacity
                key={pt.key}
                style={[styles.typeBtn, postType === pt.key && styles.typeBtnActive, styles.typeBtnRow]}
                onPress={() => setPostType(pt.key)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: postType === pt.key }}
              >
                <Ionicons name={pt.icon} size={15} color={postType === pt.key ? colors.primary : colors.textSecondary} />
                <Text style={[styles.typeBtnText, postType === pt.key && styles.typeBtnTextActive]}>
                  {pt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ETKİNLİK KARTI — yalnızca konser postunda */}
          {event && (
            <View style={styles.eventCard}>
              <Text style={styles.eventCardLabel}>{t('post_event_label')}</Text>
              <Text style={styles.eventCardName}>{event.name}</Text>
              {event.artistName && (
                <View style={styles.inlineRow}>
                  <Ionicons name="mic-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.eventCardSub}>{event.artistName}</Text>
                </View>
              )}
              {event.venueCity && (
                <View style={styles.inlineRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.eventCardSub}>{event.venueCity}</Text>
                </View>
              )}
            </View>
          )}

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
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('post_pick_photo')}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              ) : (
                <View style={styles.imagePickerEmpty}>
                  <Ionicons name="camera-outline" size={40} color={colors.textSecondary} />
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
                    <TouchableOpacity onPress={() => removePollOption(i)} style={styles.pollRemove} accessibilityRole="button" accessibilityLabel={t('delete')}>
                      <Ionicons name="close" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < 4 && (
                <TouchableOpacity style={styles.addOptionBtn} onPress={addPollOption} accessibilityRole="button">
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
            <TouchableOpacity onPress={handlePost} style={{ marginTop: 24 }} accessibilityRole="button">
              <View style={[styles.submitButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.submitText}>{t('post_share')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24 },
    backButton: { marginBottom: 16 },
    backText: { color: colors.textSecondary, fontSize: 15 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text },
    headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    typeBtnRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },

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
    eventCardSub: { fontSize: 13, color: colors.textSecondary },

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
