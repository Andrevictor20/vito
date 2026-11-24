import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { useTheme } from '../../context/ThemeContext';

interface BookingStackHeaderProps {
  onBack: () => void;
  onPressNew?: () => void;
}

export const BookingStackHeader: React.FC<BookingStackHeaderProps> = ({
  onBack,
  onPressNew,
}) => {
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
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={onBack}
        accessibilityLabel="Voltar"
      >
        <ProtoUiIcon name="arrow-back" size={20} color={colors.ink} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Geist_500Medium', fontSize: 22, color: colors.ink }}>
          Agendamentos
        </Text>
        <Text style={{ fontFamily: 'Geist', fontSize: 12.5, color: colors.muted }}>
          Links e votações de horário
        </Text>
      </View>
      {onPressNew && (
        <TouchableOpacity
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={onPressNew}
          accessibilityLabel="Novo link"
        >
          <ProtoUiIcon name="add" size={20} color={colors.bg} />
        </TouchableOpacity>
      )}
    </View>
  );
};
