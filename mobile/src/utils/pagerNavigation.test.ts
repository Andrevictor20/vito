import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAB_ORDER,
  getIndexForTab,
  getTabForIndex,
  calculatePageIndex,
  calculateScrollTarget,
  shouldPreventSwipe,
  determineBackAction,
} from './pagerNavigation';

describe('Pager Navigation Unit Tests (TDD)', () => {
  describe('Tab Ordering & Index Mapping', () => {
    test('TAB_ORDER matches [chat, calendar, tasks, triggers, booking, profile]', () => {
      assert.deepEqual(TAB_ORDER, ['chat', 'calendar', 'tasks', 'triggers', 'booking', 'profile']);
    });

    test('getIndexForTab returns correct index for each tab', () => {
      assert.equal(getIndexForTab('chat'), 0);
      assert.equal(getIndexForTab('calendar'), 1);
      assert.equal(getIndexForTab('tasks'), 2);
      assert.equal(getIndexForTab('triggers'), 3);
      assert.equal(getIndexForTab('booking'), 4);
      assert.equal(getIndexForTab('profile'), 5);
    });

    test('getTabForIndex returns correct tab identifier', () => {
      assert.equal(getTabForIndex(0), 'chat');
      assert.equal(getTabForIndex(1), 'calendar');
      assert.equal(getTabForIndex(2), 'tasks');
      assert.equal(getTabForIndex(3), 'triggers');
      assert.equal(getTabForIndex(4), 'booking');
      assert.equal(getTabForIndex(5), 'profile');
    });

    test('getTabForIndex clamps out-of-bounds indices', () => {
      assert.equal(getTabForIndex(-1), 'chat');
      assert.equal(getTabForIndex(99), 'profile');
    });
  });

  describe('Page Index & Scroll Target Calculations', () => {
    test('calculatePageIndex computes nearest page index with rounding', () => {
      const screenWidth = 400;
      assert.equal(calculatePageIndex(0, screenWidth), 0);
      assert.equal(calculatePageIndex(190, screenWidth), 0);
      assert.equal(calculatePageIndex(210, screenWidth), 1);
      assert.equal(calculatePageIndex(400, screenWidth), 1);
      assert.equal(calculatePageIndex(590, screenWidth), 1);
      assert.equal(calculatePageIndex(610, screenWidth), 2);
      assert.equal(calculatePageIndex(800, screenWidth), 2);
      assert.equal(calculatePageIndex(1190, screenWidth), 3);
      assert.equal(calculatePageIndex(1600, screenWidth), 4);
    });

    test('calculatePageIndex clamps negative and excessive offsets', () => {
      const screenWidth = 375;
      assert.equal(calculatePageIndex(-50, screenWidth), 0);
      assert.equal(calculatePageIndex(2500, screenWidth), 5);
    });

    test('calculateScrollTarget returns exact offset X in pixels', () => {
      const width = 390;
      assert.equal(calculateScrollTarget('chat', width), 0);
      assert.equal(calculateScrollTarget('calendar', width), 390);
      assert.equal(calculateScrollTarget('tasks', width), 780);
      assert.equal(calculateScrollTarget('triggers', width), 1170);
      assert.equal(calculateScrollTarget('booking', width), 1560);
      assert.equal(calculateScrollTarget('profile', width), 1950);
    });
  });

  describe('Gesture Lock & Interaction Safety', () => {
    test('shouldPreventSwipe returns true if keyboard is open', () => {
      assert.equal(shouldPreventSwipe({ isKeyboardOpen: true, hasModal: false, hasSubScreen: false }), true);
    });

    test('shouldPreventSwipe returns true if modal or subscreen is open', () => {
      assert.equal(shouldPreventSwipe({ isKeyboardOpen: false, hasModal: true, hasSubScreen: false }), true);
      assert.equal(shouldPreventSwipe({ isKeyboardOpen: false, hasModal: false, hasSubScreen: true }), true);
    });

    test('shouldPreventSwipe returns false during regular screen viewing', () => {
      assert.equal(shouldPreventSwipe({ isKeyboardOpen: false, hasModal: false, hasSubScreen: false }), false);
    });
  });

  describe('Hierarchical Back Navigation', () => {
    test('sub-screen takes precedence on back press', () => {
      const action = determineBackAction({
        activeTab: 'calendar',
        hasSubScreen: true,
        hasModal: false,
      });
      assert.equal(action.type, 'CLOSE_SUBSCREEN');
      assert.equal(action.handled, true);
    });

    test('modal takes precedence when no sub-screen is open', () => {
      const action = determineBackAction({
        activeTab: 'triggers',
        hasSubScreen: false,
        hasModal: true,
      });
      assert.equal(action.type, 'CLOSE_MODAL');
      assert.equal(action.handled, true);
    });

    test('returns to chat tab when in calendar, tasks, triggers, booking or profile', () => {
      for (const tab of ['calendar', 'tasks', 'triggers', 'booking', 'profile'] as const) {
        const action = determineBackAction({
          activeTab: tab,
          hasSubScreen: false,
          hasModal: false,
        });
        assert.equal(action.type, 'NAVIGATE_TO_TAB');
        assert.equal((action as { targetTab: string }).targetTab, 'chat');
        assert.equal(action.handled, true);
      }
    });

    test('allows app exit when already on chat without modals', () => {
      const action = determineBackAction({
        activeTab: 'chat',
        hasSubScreen: false,
        hasModal: false,
      });
      assert.equal(action.type, 'EXIT_APP');
      assert.equal(action.handled, false);
    });
  });
});
