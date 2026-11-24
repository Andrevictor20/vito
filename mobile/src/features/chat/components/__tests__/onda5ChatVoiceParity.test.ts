import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..', '..', '..', '..')

const WAVE5_FILES = [
  'features/chat/screens/ChatScreen.tsx',
  'features/chat/components/ChatInputDock.tsx',
  'features/chat/components/ChatMessageBubble.tsx',
  'features/chat/components/ChatMessageActionBar.tsx',
  'features/chat/components/ChatHistoryDrawer.tsx',
  'features/chat/components/ChatAttachmentSheet.tsx',
  'features/chat/components/ThinkingProcessAccordion.tsx',
  'features/chat/components/SwipeableConversationRow.tsx',
  'features/chat/components/cards/BookingInlineCard.tsx',
  'features/chat/components/cards/ConflictInlineCard.tsx',
  'features/chat/components/cards/DestructiveConfirmationCard.tsx',
  'features/chat/components/cards/MeetingInlineCard.tsx',
  'features/chat/components/cards/PendingInlineCard.tsx',
  'features/chat/components/cards/WhatsAppMessageInlineCard.tsx',
  'features/chat/components/cards/GmailMessageInlineCard.tsx',
  'features/chat/overlay/VoiceFullscreenView.tsx',
  'features/auth/components/LegalDocModal.tsx',
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
