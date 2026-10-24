import { StyleSheet } from 'react-native';

export const bookingStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 18,
    gap: 6,
  },
  segmentTabActive: {
    shadowColor: 'rgba(20,25,22,0.14)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentTabText: {
    fontSize: 13.5,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9,
  },
  badgeText: {
    fontSize: 11.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
