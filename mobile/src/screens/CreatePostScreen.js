import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../services/api';
import { useTheme } from '../theme';

export default function CreatePostScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { event } = route.params;
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert('Hata', 'Post içeriği boş olamaz.');
      return;
    }
    setLoading(true);
    try {
      await API.post('/posts', {
        userId: global.userId,
        eventId: event.id,
        content: content.trim(),
      });
      Alert.alert('🎉 Paylaşıldı!', 'Postun yayında!', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      Alert.alert('Hata', 'Post atılamadı, tekrar dene.');
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
            <Text style={styles.backText}>✕ İptal</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🎵 Post At</Text>
          <Text style={styles.headerSub}>{event.name}</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* ETKİNLİK KARTI */}
          <View style={styles.eventCard}>
            <Text style={styles.eventCardLabel}>ETKİNLİK</Text>
            <Text style={styles.eventCardName}>{event.name}</Text>
            {event.artistName && (
              <Text style={styles.eventCardSub}>🎤 {event.artistName}</Text>
            )}
            {event.venueCity && (
              <Text style={styles.eventCardSub}>📍 {event.venueCity}</Text>
            )}
          </View>

          {/* YAZI ALANI */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Ne düşünüyorsun?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Konseri anlat, hissettiklerini paylaş... 🎸"
              placeholderTextColor={colors.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{content.length}/500</Text>
          </View>

          {/* EMOJI KISAYOLLARI */}
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

          {/* PAYLAŞ BUTONU */}
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
                <Text style={styles.submitText}>🚀 Paylaş</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24 },
  backButton: { marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  content: { padding: 16, gap: 14 },

  eventCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventCardLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  eventCardName: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
  eventCardSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  inputCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 10, fontWeight: '600' },
  textInput: {
    color: colors.text,
    fontSize: 15,
    minHeight: 120,
    lineHeight: 22,
  },
  charCount: { textAlign: 'right', color: colors.textSecondary, fontSize: 12, marginTop: 8 },

  emojiRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  emojiBtn: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiText: { fontSize: 20 },

  submitButton: { padding: 18, borderRadius: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
