import { Platform, StyleSheet } from 'react-native';
import { tokens } from '../../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
  },
  flatList: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: tokens.spacing.sm,
  },
  emptyMessagesList: {
    flexGrow: 1,
    justifyContent: 'center',
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
    borderRadius: 999,
    zIndex: 20,
  },
  modelToastText: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    fontWeight: '500',
  },
});
