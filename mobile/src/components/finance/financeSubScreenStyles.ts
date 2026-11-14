import { StyleSheet } from 'react-native';
import { tokens } from '../../theme/tokens';

export const subScreenStyles = StyleSheet.create({
  chipsRow: {
    gap: 8,
    paddingVertical: 12,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayGroup: {
    marginTop: 6,
  },
  dayHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 6,
  },
  card2: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
  },
  card2Flush: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  bigValue: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 8,
  },
  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 8,
  },
  secTitle: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12.5,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  legendList: {
    marginTop: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  splitMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'visible',
    marginTop: 10,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  primaryPillBtn: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryPillBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  avatarBig: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBigText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
});
