import { StyleSheet, Platform } from 'react-native';
import { tokens } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  centerBox: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
  },
  section: {
    gap: tokens.spacing.md,
  },
  connectedCard: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radii.full,
  },
  statusBadgeText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  phoneLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
  },
  featuresList: {
    gap: tokens.spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  featureText: {
    flex: 1,
    fontSize: tokens.typography.size.sm,
    lineHeight: 18,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    marginTop: tokens.spacing.xs,
  },
  disconnectBtnText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  pairingCard: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
  },
  inputLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  inputHint: {
    fontSize: tokens.typography.size.xs,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: tokens.typography.size.md,
    paddingVertical: tokens.spacing.xs,
  },
  errorMsg: {
    fontSize: tokens.typography.size.xs,
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    marginTop: tokens.spacing.sm,
  },
  primaryBtnText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  codeDisplayCard: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: tokens.spacing.md,
    alignItems: 'center',
  },
  codeCardTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  codeHighlightBox: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.full,
  },
  copyBtnText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  instructionsBox: {
    alignSelf: 'stretch',
    gap: 6,
    paddingTop: tokens.spacing.xs,
  },
  instructionsTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  instructionStep: {
    fontSize: tokens.typography.size.xs,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
    width: '100%',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '600',
  },
});
