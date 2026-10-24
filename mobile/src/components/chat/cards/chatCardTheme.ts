import { StyleSheet } from 'react-native';
import { loginPalette, LoginPalette } from '../../login/loginPalette';

export interface ChatCardTheme {
  palette: LoginPalette;
  isDark: boolean;
}

export function useChatCardTheme(isDark: boolean) {
  const palette = loginPalette(isDark);
  return { palette, isDark };
}

export const chatCardBaseStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    fontWeight: '600',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 0,
  },
  tagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  btnFill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnFillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  btnOutline: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnOutlineText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
});
