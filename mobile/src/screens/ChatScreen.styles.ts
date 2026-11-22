import { StyleSheet, Platform } from 'react-native';
import { tokens, MD3Shapes } from '../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  flatList: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  loadingText: {
    color: tokens.colors.onSurfaceVariant,
    fontSize: tokens.typography.size.bodySmall,
  },
  emptyMessagesList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  suggestionsWrapper: {
    paddingBottom: 4,
  },
  dockContainer: {
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'android' ? 8 : 8,
  },
  modelToast: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    zIndex: 20,
  },
  modelToastText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
