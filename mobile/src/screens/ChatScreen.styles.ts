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
});
