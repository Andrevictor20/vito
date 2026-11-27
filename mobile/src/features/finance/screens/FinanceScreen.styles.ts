import { StyleSheet } from 'react-native';

export const financeScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  headLeft: {
    flex: 1,
    minWidth: 0,
  },
  mainTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '500',
    letterSpacing: -0.96,
  },
  mainSubtitle: {
    fontFamily: 'Geist',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '400',
  },
  headActs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  rb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'flex-start',
    marginTop: 6,
    marginBottom: 10,
  },
  emptyChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  emptySub: {
    fontFamily: 'Geist',
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 6,
  },
  emptyCta: {
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    alignSelf: 'stretch',
  },
  emptyCtaText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    fontWeight: '500',
  },
  secHeader: {
    marginTop: 14,
    marginBottom: 10,
  },
  secTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  exScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  exChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exChipText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
});
