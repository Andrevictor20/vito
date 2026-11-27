import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..')

const WAVE8_FILES = [
  'features/bots/screens/BotsScreen.tsx',
  'features/calendar/screens/BookingScreen.tsx',
  'features/calendar/screens/ExecutiveSummariesHubView.tsx',
  'features/notifications/screens/NotificationsScreen.tsx',
  'features/bots/components/MascotStudioModal.tsx',
  'features/calendar/components/booking/MeetingPollSlotItem.tsx',
]

test('Onda 8 — Bots, Booking, Resumos e Notificações usam ds/tokens e SVGs próprios sem @expo/vector-icons', () => {
  for (const rel of WAVE8_FILES) {
    const content = fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8')
    assert.equal(content.includes('@expo/vector-icons'), false, `${rel} não deve importar @expo/vector-icons`)
    assert.equal(content.includes('MaterialIcons'), false, `${rel} não deve referenciar MaterialIcons`)
  }
  const slotItem = fs.readFileSync(path.join(MOBILE_SRC, 'features/calendar/components/booking/MeetingPollSlotItem.tsx'), 'utf8')
  assert.equal(slotItem.includes('MOTION_CURVES.q'), true, 'MeetingPollSlotItem deve usar MOTION_CURVES.q')
})
