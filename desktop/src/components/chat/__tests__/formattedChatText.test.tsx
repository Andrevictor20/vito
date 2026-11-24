import { describe, it, expect } from 'vitest';
import {
  isTableSeparatorRow,
  parseMarkdownTableRow,
} from '../FormattedChatMessageText';

describe('Desktop FormattedChatMessageText — Tabelas Markdown', () => {
  it('detecta linha separadora e faz parse de pipes escapados', () => {
    expect(isTableSeparatorRow('| Data | Descrição | Valor |')).toBe(false);
    expect(isTableSeparatorRow('|------|-----------|-------|')).toBe(true);
    expect(
      parseMarkdownTableRow('| 20/11 | Compra via NuPay\\|EBW\\|Spotify | -R$ 12,90 |')
    ).toEqual(['20/11', 'Compra via NuPay|EBW|Spotify', '-R$ 12,90']);
  });
});
