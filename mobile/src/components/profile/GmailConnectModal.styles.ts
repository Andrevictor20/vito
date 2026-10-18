import { StyleSheet } from 'react-native';
import { tokens } from '../../theme/tokens';

export const styles = StyleSheet.create({
  content: {
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.md,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  loadingText: {
    fontSize: 13,
  },
  disconnectedBox: {
    gap: tokens.spacing.md,
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  featureList: {
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  featureText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm + 2,
    borderRadius: tokens.radii.sm,
  },
  privacyText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  connectedBox: {
    gap: tokens.spacing.md,
  },
  statusCard: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    gap: tokens.spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusEmailCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emailText: {
    fontSize: 15,
    fontWeight: '600',
  },
  disconnectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  disconnectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  lastScannedText: {
    fontSize: 11,
    marginTop: 4,
  },
  resultsContainer: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  resultsHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultCard: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  amountTag: {
    fontSize: 14,
    fontWeight: '800',
  },
  dueDateText: {
    fontSize: 12,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 6,
    gap: 8,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  locatorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  locatorText: {
    color: '#1E40AF',
    fontSize: 11,
    fontWeight: '700',
  },
  flightRouteText: {
    fontSize: 12,
  },
  urgentReasonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
