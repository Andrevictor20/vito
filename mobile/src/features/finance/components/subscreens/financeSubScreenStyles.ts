import { StyleSheet } from 'react-native';

export const subScreenStyles = StyleSheet.create({
  chipsRow: {
    gap: 8,
    paddingVertical: 12,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
  dayGroup: {
    marginTop: 6,
  },
  dayHeader: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    marginTop: 10,
    marginBottom: 6,
  },
  card2: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginTop: 8,
  },
  card2Flush: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  eyebrow: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
  },
  bigValue: {
    fontFamily: 'Geist_500Medium',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '500',
    letterSpacing: -1.02,
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
    fontFamily: 'Geist_500Medium',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.34,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
    fontWeight: '500',
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
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    fontWeight: '500',
  },
  rowMeta: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 2,
  },
  rowAmount: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    fontWeight: '500',
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
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
    fontWeight: '500',
  },
  avatarBig: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBigText: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontFamily: 'Geist',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
});
