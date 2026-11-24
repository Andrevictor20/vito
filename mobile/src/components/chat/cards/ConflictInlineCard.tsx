import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { ConflictInfo } from '../../../types';
import { PressableScale } from '../../../theme/vitoMotion';

interface ConflictInlineCardProps {
  conflict: ConflictInfo;
  onPressAdjust?: () => void;
  onSelectSlot?: (slot: import('../../../types').TimeSlot) => void;
}

export const ConflictInlineCard: React.FC<ConflictInlineCardProps> = ({ conflict, onPressAdjust, onSelectSlot }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surf }]}>
      <View style={styles.contentRow}>
        <View style={styles.leftGroup}>
          <View style={[styles.iconBox, { backgroundColor: colors.orangeBg }]}>
            <ProtoUiIcon name="warning" size={18} color={colors.orange} />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
              {conflict.conflicting_title || 'Conflito de Agenda'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.orange }]} numberOfLines={2}>
              {conflict.message || 'Atenção: Horário sobreposto com outro compromisso'}
            </Text>
          </View>
        </View>

        {onPressAdjust && (
          <PressableScale
            style={[styles.adjustBtn, { backgroundColor: colors.bg }]}
            onPress={onPressAdjust}
          >
            <Text style={[styles.adjustBtnText, { color: colors.ink }]}>Ajustar</Text>
          </PressableScale>
        )}
      </View>

      {conflict.suggested_slots && conflict.suggested_slots.length > 0 && (
        <View style={[styles.slotsSection, { borderTopColor: colors.line }]}>
          <Text style={[styles.slotsHeader, { color: colors.muted }]}>
            Sugestões de horário livre:
          </Text>
          <View style={styles.slotsRow}>
            {conflict.suggested_slots.map((slot, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.slotChip, { backgroundColor: colors.bg }]}
                onPress={() => onSelectSlot?.(slot)}
                activeOpacity={0.75}
              >
                <ProtoUiIcon name="schedule" size={13} color={colors.blue} />
                <Text style={[styles.slotChipText, { color: colors.ink }]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 0,
    padding: 14,
    marginTop: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
    fontWeight: '500',
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 2,
  },
  adjustBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtnText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
  slotsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  slotsHeader: {
    fontFamily: 'Geist',
    fontSize: 12,
    marginBottom: 6,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  slotChipText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
    fontWeight: '500',
  },
});
