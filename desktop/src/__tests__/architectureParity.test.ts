import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Paridade Arquitetural Desktop ↔ Mobile (Plano 13)', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const desktopSrcDir = path.resolve(__dirname, '..');
  const mobileSrcDir = path.resolve(rootDir, 'mobile/src');

  // =========================================================================
  // Requisito 1: Regra No-God-Files (<500 linhas)
  // =========================================================================
  it('AC-09: nenhum arquivo em desktop/src/ deve exceder 500 linhas de código', () => {
    const oversizedFiles: { file: string; lines: number }[] = [];

    function scanFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            scanFiles(fullPath);
          }
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n').length;
          if (lines >= 500) {
            oversizedFiles.push({
              file: path.relative(desktopSrcDir, fullPath),
              lines,
            });
          }
        }
      }
    }

    scanFiles(desktopSrcDir);

    expect(
      oversizedFiles,
      `Arquivos excedendo o limite de 500 linhas detectados:\n${oversizedFiles
        .map((f) => ` - ${f.file} (${f.lines} linhas)`)
        .join('\n')}`
    ).toEqual([]);
  });

  // =========================================================================
  // Requisito 2: Paridade dos 11 Cartões Estruturados de Chat
  // =========================================================================
  it('AC-05: todos os 11 cartões estruturados de chat do mobile devem existir no desktop', () => {
    const mobileCardsDir = path.resolve(mobileSrcDir, 'components/chat/cards');
    const desktopCardsDir = path.resolve(desktopSrcDir, 'components/chat/cards');

    expect(
      fs.existsSync(desktopCardsDir),
      `Diretório de cartões do desktop não encontrado: ${desktopCardsDir}`
    ).toBe(true);

    const mobileCards = fs
      .readdirSync(mobileCardsDir)
      .filter((file: string) => file.endsWith('.tsx') && !file.includes('.test.'));

    const desktopCards = fs.readdirSync(desktopCardsDir);

    // Mapeamento de possíveis equivalências de nomes
    const nameAliases: Record<string, string[]> = {
      'WhatsAppMessageInlineCard.tsx': ['WhatsAppMessageInlineCard.tsx', 'WhatsAppMessageCard.tsx'],
      'GmailMessageInlineCard.tsx': ['GmailMessageInlineCard.tsx', 'GmailMessageCard.tsx'],
    };

    const missingCards: string[] = [];

    for (const card of mobileCards) {
      const allowedNames = nameAliases[card] || [card];
      const hasMatch = allowedNames.some((alias) => desktopCards.includes(alias));
      if (!hasMatch) {
        missingCards.push(card);
      }
    }

    expect(
      missingCards,
      `Cartões estruturados do mobile ausentes em desktop/src/components/chat/cards/:\n${missingCards
        .map((c) => ` - ${c}`)
        .join('\n')}`
    ).toEqual([]);
  });

  // =========================================================================
  // Requisito 3: Paridade dos Utilitários de Negócio Puros
  // =========================================================================
  it('AC-02: utilitários essenciais de negócio do mobile devem possuir paridade no desktop', () => {
    const desktopUtilsDir = path.resolve(desktopSrcDir, 'utils');
    expect(fs.existsSync(desktopUtilsDir)).toBe(true);

    const desktopUtils = fs.readdirSync(desktopUtilsDir);

    // Utilitários essenciais de lógica pura de negócio mapeados no Plano 13
    const essentialUtils = [
      'chatCardExtractors.ts',
      'chatGreetings.ts',
      'chatHistoryGrouping.ts',
      'radarFilter.ts',
      'radarReportUtils.ts',
      'weeklySummaryCalculator.ts',
      'agendaFilter.ts',
      'calendarDateUtils.ts',
      'taskBuckets.ts',
      'summaryCalculators.ts',
      'meetingPollUtils.ts',
      'slotAvailability.ts',
      'tokiCalendarUtils.ts',
      'unifiedTasks.ts',
      'phoneFormat.ts',
      'chatSendGuard.ts',
    ];

    const missingUtils: string[] = [];

    for (const utilFile of essentialUtils) {
      if (!desktopUtils.includes(utilFile)) {
        missingUtils.push(utilFile);
      }
    }

    expect(
      missingUtils,
      `Utilitários essenciais ausentes em desktop/src/utils/:\n${missingUtils
        .map((u) => ` - ${u}`)
        .join('\n')}`
    ).toEqual([]);
  });

  // =========================================================================
  // Requisito 4: Chamadas a APIs nas Views via Hooks de Domínio (src/hooks/)
  // =========================================================================
  it('AC-04: views não devem chamar o cliente de API diretamente; devem delegar a src/hooks/', () => {
    const hooksDir = path.resolve(desktopSrcDir, 'hooks');

    // 1. O diretório desktop/src/hooks/ deve existir com os 9 hooks canônicos
    expect(
      fs.existsSync(hooksDir),
      'Diretório desktop/src/hooks/ inexistente. Deve ser criado na Wave 2.'
    ).toBe(true);

    const canonicalHooks = [
      'useChat.ts',
      'useChatMessages.ts',
      'useChatSessions.ts',
      'useHomeData.ts',
      'useCalendarSync.ts',
      'usePendingItems.ts',
      'useTriggers.ts',
      'useNotifications.ts',
      'chatMessageEffects.ts',
    ];

    const existingHooks = fs.existsSync(hooksDir) ? fs.readdirSync(hooksDir) : [];
    const missingHooks = canonicalHooks.filter((hook) => !existingHooks.includes(hook));

    expect(
      missingHooks,
      `Hooks de domínio ausentes em desktop/src/hooks/:\n${missingHooks
        .map((h) => ` - ${h}`)
        .join('\n')}`
    ).toEqual([]);

    // 2. Views não devem ter importação direta de services/api
    const viewsToAudit = [
      'components/chat/ChatView.tsx',
      'components/calendar/CalendarView.tsx',
      'components/tasks/TasksView.tsx',
      'components/triggers/TriggersView.tsx',
    ];

    const violatingViews: string[] = [];

    for (const relativePath of viewsToAudit) {
      const fullPath = path.resolve(desktopSrcDir, relativePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Verifica se há import direto do cliente api
        if (
          content.includes("from '../../services/api'") ||
          content.includes('from "../services/api"') ||
          content.includes("from '../services/api'") ||
          content.includes("from '@/services/api'")
        ) {
          violatingViews.push(relativePath);
        }
      }
    }

    expect(
      violatingViews,
      `Views com acoplamento direto à API (devem migrar para hooks de domínio):\n${violatingViews
        .map((v) => ` - ${v}`)
        .join('\n')}`
    ).toEqual([]);
  });
});
