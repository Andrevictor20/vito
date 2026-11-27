import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..', '..', '..', '..')

const WAVE6_FILES = [
  'features/calendar/components/AgendaView.tsx',
  'features/tasks/screens/TasksScreen.tsx',
  'features/tasks/components/DailyTasksSummaryCard.tsx',
  'features/tasks/components/CompletedAccordion.tsx',
  'features/tasks/components/TaskSubtasksInline.tsx',
  'features/tasks/components/TaskDetailSheet.tsx',
  'features/tasks/components/TaskGroupHeader.tsx',
  'features/tasks/components/TaskRow.tsx',
]

test('Onda 6 — Agenda e Tarefas usam ProtoRingChart, theme/tokens e SVGs próprios sem @expo/vector-icons', () => {
  for (const rel of WAVE6_FILES) {
    const content = fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8')
    assert.equal(content.includes('@expo/vector-icons'), false, `${rel} não deve importar @expo/vector-icons`)
    assert.equal(content.includes('MaterialIcons'), false, `${rel} não deve referenciar MaterialIcons`)
  }
  const summaryCard = fs.readFileSync(path.join(MOBILE_SRC, 'features/tasks/components/DailyTasksSummaryCard.tsx'), 'utf8')
  assert.equal(summaryCard.includes('ProtoRingChart'), true, 'DailyTasksSummaryCard deve usar ProtoRingChart')
  assert.equal(summaryCard.includes('theme/tokens'), true, 'DailyTasksSummaryCard deve usar theme/tokens')
})
