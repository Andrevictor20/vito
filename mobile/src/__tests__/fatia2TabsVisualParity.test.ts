import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDEA_CARDS } from '../utils/chatIdeasDeckMotion';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = path.resolve(__dirname, '..');

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('Fatia 2 — Paridade Visual das 5 Abas Principais & Tipografia Geist Global', () => {
  it('Zero fontes não registradas (Inter_ / Montserrat_ / Roboto_) em mobile/src', () => {
    const offenders: string[] = [];
    for (const file of walkTs(SRC)) {
      const content = fs.readFileSync(file, 'utf8');
      if (/fontFamily:\s*['"](?:Inter_|Montserrat_|Roboto_)/.test(content)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    assert.deepEqual(offenders, [], `Fontes não registradas encontradas em: ${offenders.join(', ')}`);

    const vitoSheet = fs.readFileSync(path.join(SRC, 'components/ui/VitoSheet.tsx'), 'utf8');
    assert.equal(vitoSheet.includes("fontFamily: 'Geist_500Medium'"), true);
  });

  it('Dock sem corte de label, ChatIdeasDeck com tríade de cores e TasksScreen com faixa única de listas', () => {
    const dock = fs.readFileSync(path.join(SRC, 'components/common/FloatingTabBar.tsx'), 'utf8');
    assert.equal(dock.includes('ellipsizeMode="clip"'), false, 'FloatingTabBar não deve usar ellipsizeMode="clip" que corta o label');
    assert.equal(dock.includes('[0, 88]'), true, 'FloatingTabBar deve dar folga de 88px ao label expandido');

    assert.equal(IDEA_CARDS[IDEA_CARDS.length - 1].layout, 'radar', 'Card lateral esquerdo do deck deve usar tom âmbar (radar)');

    const tasks = fs.readFileSync(path.join(SRC, 'screens/TasksScreen.tsx'), 'utf8');
    assert.equal(tasks.includes('<TaskFilterChips'), false, 'TasksScreen não deve renderizar a faixa oculta TaskFilterChips');
    assert.equal(tasks.includes('<TaskListChips'), true, 'TasksScreen deve renderizar apenas TaskListChips');
  });

  it('FinanceScreen e BotsCatalogTab/BotsScreen alinhados ao protótipo + Reanimated 4', () => {
    const fin = fs.readFileSync(path.join(SRC, 'screens/FinanceScreen.tsx'), 'utf8');
    assert.equal(fin.includes("Conecte seus bancos via Open Finance'"), false, 'Subtítulo do header de Finanças não deve truncar');
    assert.equal(fin.includes('backgroundColor: colors.surf, borderColor: colors.hairline'), true, 'Chips Pergunte ao Vito devem usar superfície --surf');

    const bots = fs.readFileSync(path.join(SRC, 'screens/BotsScreen.tsx'), 'utf8');
    assert.equal(bots.includes("from 'react-native-reanimated'"), true, 'BotsScreen deve usar Reanimated 4');
    assert.equal(bots.includes('new Animated.Value'), false);

    const catalog = fs.readFileSync(path.join(SRC, 'components/bots/BotsCatalogTab.tsx'), 'utf8');
    assert.equal(catalog.includes("from 'react-native-reanimated'"), true, 'BotsCatalogTab deve usar Reanimated 4');
    assert.equal(catalog.includes('new Animated.Value'), false);
    assert.equal(catalog.includes('Personalize corpo, olhos, chapéu e gravata antes de ativar'), true);
    assert.equal(catalog.includes('backgroundColor: colors.surf, borderColor: colors.hairline'), true);
  });
});
