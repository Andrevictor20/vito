import { StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: tokens.colors.textPrimary,
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radii.sm,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    marginTop: 4,
    marginBottom: tokens.spacing.lg,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: tokens.spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 44,
    backgroundColor: tokens.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    color: tokens.colors.textPrimary,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: tokens.colors.primary,
    height: 44,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  demoButton: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primary,
    height: 44,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing.md,
  },
  demoButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: tokens.spacing.lg,
    alignItems: 'center',
  },
  switchText: {
    color: tokens.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
});
