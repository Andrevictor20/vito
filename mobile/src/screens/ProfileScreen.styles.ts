import { StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';

export const profileStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: tokens.spacing.md, paddingBottom: 120 },
  lbl: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  lst: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  li: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  liIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '500',
    fontFamily: tokens.typography.family.medium,
  },
  liMeta: {
    fontSize: 13,
    marginRight: 2,
  },
  divider: {
    height: 1,
    marginLeft: 60,
  },
  themeSeg: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    width: 190,
  },
  themeBtn: {
    flex: 1,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  themeBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  themeBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  out: { flexDirection: 'row', gap: 10, marginTop: 22 },
  outBtn: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  outBtnDanger: { backgroundColor: 'transparent' },
  outBtnText: { fontSize: 14, fontWeight: '600', fontFamily: tokens.typography.family.medium },
  ver: { textAlign: 'center', fontSize: 12, marginTop: 16 },
});
