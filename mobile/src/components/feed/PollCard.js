import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import API from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';

export default function PollCard({ postId, options: initialOptions, onVoted }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [options, setOptions] = useState(initialOptions);
  const [voting, setVoting] = useState(false);
  const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);
  const hasVoted = options.some(o => o.voted);

  const handleVote = async (optionId) => {
    if (voting || hasVoted) return;
    setVoting(true);
    try {
      const res = await API.post(`/posts/${postId}/poll/vote?optionId=${optionId}`);
      setOptions(res.data);
      onVoted?.(res.data);
    } catch (err) {
      Alert.alert(t('error'), t('post_poll_vote_error'));
    } finally {
      setVoting(false);
    }
  };

  return (
    <View style={styles.pollCard}>
      {options.map(opt => {
        const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.pollOption, opt.voted && styles.pollOptionVoted]}
            onPress={() => handleVote(opt.id)}
            activeOpacity={hasVoted ? 1 : 0.7}
            disabled={hasVoted || voting}
          >
            {hasVoted && <View style={[styles.pollBar, { width: `${pct}%` }]} />}
            {opt.voted && <Ionicons name="checkmark" size={16} color={colors.primary} style={styles.pollCheck} />}
            <Text style={[styles.pollOptionText, opt.voted && styles.pollOptionTextVoted]}>
              {opt.optionText}
            </Text>
            {hasVoted && <Text style={styles.pollPct}>{pct}%</Text>}
          </TouchableOpacity>
        );
      })}
      <Text style={styles.pollTotal}>{t('post_poll_votes', { n: totalVotes })}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    pollCard: { gap: 8, marginBottom: 14 },
    pollOption: {
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 12, flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, overflow: 'hidden', position: 'relative', minHeight: 44,
    },
    pollOptionVoted: { borderColor: colors.primary },
    pollBar: {
      position: 'absolute', left: 0, top: 0, bottom: 0,
      backgroundColor: colors.primary + '22', borderRadius: 12,
    },
    pollCheck: { marginRight: 6 },
    pollOptionText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
    pollOptionTextVoted: { color: colors.primary },
    pollPct: { fontSize: 13, fontWeight: '800', color: colors.primary },
    pollTotal: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  });
}
