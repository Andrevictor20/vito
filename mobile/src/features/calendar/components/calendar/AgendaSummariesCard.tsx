import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { useTheme } from '../../../../context/ThemeContext';

interface AgendaSummariesCardProps {
  eventsCount: number;
  onPress: () => void;
}

export const AgendaSummariesCard: React.FC<AgendaSummariesCardProps> = ({
  eventsCount,
  onPress,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surf }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Resumos da semana"
    >
      <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
        <ProtoUiIcon name="bar-chart" size={18} color={colors.ink} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
          Resumos da semana
        </Text>
        <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>
          {eventsCount} {eventsCount === 1 ? 'evento' : 'eventos'} · Ver raio-X
        </Text>
      </View>
      <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 14,
    marginTop: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    fontWeight: '500',
  },
  sub: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 2,
  },
});
