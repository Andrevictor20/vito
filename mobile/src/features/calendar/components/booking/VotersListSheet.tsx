import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { VitoSheet } from '../../../../components/ui/VitoSheet';

export const VOTER_AVATAR_COLORS = ['#0a7cff', '#0aa55c', '#ff2fa0', '#f08300', '#7a4fe0', '#0aa5b5'];

export function getInitials(name: string): string {
  const parts = (name || 'U').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface VotersListSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  voters: string[];
}

export const VotersListSheet: React.FC<VotersListSheetProps> = ({
  visible,
  onClose,
  title,
  voters,
}) => {
  const { colors } = useTheme();
  const sub = `${voters.length} ${voters.length === 1 ? 'participante votou' : 'participantes votaram'}`;

  return (
    <VitoSheet visible={visible} onClose={onClose} title={title} subtitle={sub}>
      <ScrollView contentContainerStyle={styles.list}>
        {voters.map((name, idx) => (
          <View
            key={`${name}-${idx}`}
            style={[
              styles.item,
              idx < voters.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line },
            ]}
          >
            <View
              style={[
                styles.av,
                { backgroundColor: VOTER_AVATAR_COLORS[idx % VOTER_AVATAR_COLORS.length] },
              ]}
            >
              <Text style={styles.avText}>{getInitials(name)}</Text>
            </View>
            <View style={styles.textCol}>
              <Text style={[styles.name, { color: colors.ink }]}>{name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Votou neste horário</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </VitoSheet>
  );
};

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  av: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  textCol: { flex: 1 },
  name: { fontSize: 14.5, fontWeight: '500' },
  meta: { fontSize: 12.5, marginTop: 1 },
});
