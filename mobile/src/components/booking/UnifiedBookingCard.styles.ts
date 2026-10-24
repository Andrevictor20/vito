import { StyleSheet } from 'react-native';
import { tokens, MD3Shapes } from '../../theme/tokens';

export const styles = StyleSheet.create({
  card: {
    padding: tokens.booking.cardPadding,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: tokens.booking.cardGap,
    marginBottom: tokens.booking.sectionGap,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: tokens.booking.titleSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: tokens.booking.metaSize,
    lineHeight: 16,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: MD3Shapes.small,
  },
  durationPillText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.booking.statusPillRadius,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '500',
  },
  metaDivider: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#888',
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urlText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '500',
    flex: 1,
  },
  leadingSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  leadingSlotText: {
    fontSize: tokens.booking.metaSize,
    flex: 1,
  },
  emptySlotText: {
    fontSize: tokens.booking.metaSize,
  },
  apptGuestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: tokens.booking.titleSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  guestEmail: {
    fontSize: tokens.booking.metaSize,
    marginTop: 1,
  },
  confirmedPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.booking.statusPillRadius,
  },
  confirmedPillText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '700',
  },
  notesBox: {
    padding: 8,
    borderRadius: 6,
  },
  notesText: {
    fontSize: tokens.booking.metaSize,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  actionBtn: {
    width: tokens.booking.actionHeight,
    height: tokens.booking.actionHeight,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: tokens.booking.actionHeight,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    paddingHorizontal: 10,
    flex: 1,
  },
  copyButtonText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '600',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: tokens.booking.actionHeight,
    borderRadius: MD3Shapes.small,
    paddingHorizontal: 10,
    flex: 1,
  },
  confirmButtonText: {
    fontSize: tokens.booking.metaSize,
    fontWeight: '700',
  },
});
