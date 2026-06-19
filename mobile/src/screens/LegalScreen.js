import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useTheme } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { LEGAL_CONTENT } from '../constants/legalContent';

export default function LegalScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const doc = route?.params?.doc === 'privacy' ? 'privacy' : 'terms';
  const content = (LEGAL_CONTENT[lang] || LEGAL_CONTENT.tr)[doc];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{content.title}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.updated}>{content.updated}</Text>
        {content.sections.map((s, i) => (
          <View key={i} style={styles.section}>
            {s.h ? <Text style={styles.sectionHeading}>{s.h}</Text> : null}
            <Text style={styles.sectionBody}>{s.b}</Text>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 40, alignItems: 'center' },
    backText: { fontSize: 24, color: colors.text },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },

    body: { padding: 20 },
    updated: { fontSize: 12, color: colors.textSecondary, marginBottom: 20, fontStyle: 'italic' },
    section: { marginBottom: 18 },
    sectionHeading: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
    sectionBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  });
}
