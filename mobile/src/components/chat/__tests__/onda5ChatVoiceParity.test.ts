import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..', '..', '..')

const WAVE5_FILES = [
  'screens/ChatScreen.tsx',
  'components/chat/ChatInputDock.tsx',
  'components/chat/ChatMessageBubble.tsx',
  'components/chat/ChatMessageActionBar.tsx',
  'components/chat/ChatHistoryDrawer.tsx',
  'components/chat/ChatAttachmentSheet.tsx',
  'components/chat/ThinkingProcessAccordion.tsx',
  'components/chat/SwipeableConversationRow.tsx',
  'components/chat/cards/BookingInlineCard.tsx',
  'components/chat/cards/ConflictInlineCard.tsx',
  'components/chat/cards/DestructiveConfirmationCard.tsx',
  'components/chat/cards/MeetingInlineCard.tsx',
  'components/chat/cards/PendingInlineCard.tsx',
  'components/chat/cards/WhatsAppMessageInlineCard.tsx',
  'components/chat/cards/GmailMessageInlineCard.tsx',
  'overlay/VoiceFullscreenView.tsx',
  'components/login/LegalDocModal.tsx',
]

test('Onda 5 — Chat, cards, voz e legal modal usam SVGs do protótipo sem @expo/vector-icons', () => {
  for (const rel of WAVE5_FILES) {
    const content = fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8')
    assert.equal(
      content.includes('@expo/vector-icons'),
      false,
      `${rel} não deve importar @expo/vector-icons`,
    )
    assert.equal(
      content.includes('MaterialIcons'),
      false,
      `${rel} não deve referenciar MaterialIcons`,
    )
  }
})
