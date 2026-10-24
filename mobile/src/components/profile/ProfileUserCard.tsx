import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';

interface ProfileUserCardProps {
  name: string;
  email: string;
  phone?: string;
  onEditPhone?: () => void;
  quotaPercentage?: number;
}

export const ProfileUserCard: React.FC<ProfileUserCardProps> = ({
  name,
  email,
  phone,
  onEditPhone,
}) => {
  const { colors } = useTheme();
  const initials = (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <View style={[styles.pf, { backgroundColor: colors.surf, borderColor: colors.line }]}>
      {/* Avatar circular de 60px (.av) */}
      <View style={[styles.av, { backgroundColor: colors.ink }]}>
        <Text style={[styles.avText, { color: colors.bg }]}>
          {initials || 'U'}
        </Text>
      </View>

      {/* Info do Usuário */}
      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
            {name}
          </Text>
          <MaterialIcons name="check-circle" size={18} color={colors.blue} />
        </View>

        <Text style={[styles.email, { color: colors.muted }]} numberOfLines={1}>
          {email}
        </Text>

        {onEditPhone ? (
          <TouchableOpacity
            style={[styles.phn, { backgroundColor: colors.greenBg }]}
            onPress={onEditPhone}
            activeOpacity={0.7}
            accessibilityLabel="Editar ou confirmar telefone"
          >
            <MaterialIcons name="verified-user" size={13} color={colors.acc} />
            <Text style={[styles.phnText, { color: colors.acc }]}>
              {phone ? formatPhoneNumber(phone) : '+ Confirmar telefone'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 8,
  },
  av: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avText: {
    fontSize: 20,
    fontFamily: tokens.typography.family.montserratBold,
    fontWeight: '800',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 18,
    fontFamily: tokens.typography.family.montserratBold,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13.5,
    marginTop: 2,
  },
  phn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  phnText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: tokens.typography.family.medium,
  },
});
