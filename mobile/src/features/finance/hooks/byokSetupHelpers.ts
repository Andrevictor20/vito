import * as Clipboard from 'expo-clipboard';
import { extractUuids } from '../utils/pluggyKeys';
import { PluggyError } from '../services/pluggyService';
import type { PluggySyncResult } from '../services/pluggySync';

export async function readFilteredClipboardUuids(
  clientId: string,
  clientSecret: string,
): Promise<string[]> {
  const raw = await Clipboard.getStringAsync().catch(() => '');
  return extractUuids(raw)
    .filter(
      (u) =>
        u.toLowerCase() !== clientId.toLowerCase() &&
        u.toLowerCase() !== clientSecret.toLowerCase(),
    )
    .slice(0, 2);
}

export function extractUniqueBankNames(
  resultsList: PluggySyncResult[],
  existingBanks: string[] = [],
): string[] {
  const banks = Array.from(
    new Set(
      [...resultsList.map((r) => r.institutionName), ...existingBanks].filter(
        (n) => Boolean(n && n.trim().length > 0),
      ),
    ),
  );
  return banks.length > 0 ? banks : ['Meu Pluggy'];
}

export function formatByokError(err: unknown, fallback: string): string {
  if (err instanceof PluggyError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
