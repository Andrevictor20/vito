import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface BookingStackHeaderProps {
  onBack: () => void;
}

export const BookingStackHeader: React.FC<BookingStackHeaderProps> = ({ onBack }) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 6,
      }}
    >
      <TouchableOpacity
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surf,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={onBack}
        accessibilityLabel="Voltar"
      >
        <MaterialIcons name="arrow-back" size={20} color={colors.ink} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 22, fontWeight: '600', color: colors.ink }}>Agendamentos</Text>
        <Text style={{ fontSize: 12.5, color: colors.muted }}>Links e votações de horário</Text>
      </View>
    </View>
  );
};
