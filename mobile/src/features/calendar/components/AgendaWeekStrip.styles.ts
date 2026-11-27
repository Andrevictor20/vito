import { StyleSheet } from 'react-native';
import { tokens } from '../../../theme/tokens';

export const agendaWeekStripStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 12,
  },
  mh: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  mhTitleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mhTitle: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    letterSpacing: -0.34,
  },
  mhYear: {
    fontFamily: tokens.typography.family.medium,
    fontSize: 14,
    fontWeight: '500',
  },
  mhActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniSq: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnText: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 13,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  dayLabel: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 16,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  monthGridContainer: {
    marginTop: 4,
  },
  gridWeekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gridWeekdayCol: {
    width: '14.28%',
    alignItems: 'center',
  },
  gridBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridDayCol: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  monthDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayNumber: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 14,
    lineHeight: 16,
  },
});
