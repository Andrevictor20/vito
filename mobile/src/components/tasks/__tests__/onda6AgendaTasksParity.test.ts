import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..', '..', '..')

const WAVE6_FILES = [
  'components/home/AgendaView.tsx',
  'screens/TasksScreen.tsx',
  'components/tasks/DailyTasksSummaryCard.tsx',
  'components/tasks/CompletedAccordion.tsx',
  'components/tasks/TaskSubtasksInline.tsx',
  'components/tasks/TaskDetailSheet.tsx',
  'components/tasks/TaskGroupHeader.tsx',
  'components/tasks/TaskRow.tsx',
]

test('Onda 6 — Agenda e Tarefas usam ProtoRingChart, ds/tokens e SVGs próprios sem @expo/vector-icons', () => {
  for (const rel of WAVE6_FILES) {
    const content = fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8')
    assert.equal(content.includes('@expo/vector-icons'), false, `${rel} não deve importar @expo/vector-icons`)
    assert.equal(content.includes('MaterialIcons'), false, `${rel} não deve referenciar MaterialIcons`)
  }
  const summaryCard = fs.readFileSync(path.join(MOBILE_SRC, 'components/tasks/DailyTasksSummaryCard.tsx'), 'utf8')
  assert.equal(summaryCard.includes('ProtoRingChart'), true, 'DailyTasksSummaryCard deve usar ProtoRingChart')
  assert.equal(summaryCard.includes("from '../../ds/tokens'"), true, 'DailyTasksSummaryCard deve usar ds/tokens')
})
