import type { FinanceAccount } from '../types/finance';

export interface BankBrand {
  name: string;
  initials: string;
  color: string;
  textColor: string;
}

export function getBankBrand(institutionName?: string): BankBrand {
  const norm = (institutionName || '').toLowerCase();
  if (norm.includes('nu')) {
    return { name: 'Nubank', initials: 'nu', color: '#820AD1', textColor: '#FFFFFF' };
  }
  if (norm.includes('itaú') || norm.includes('itau')) {
    return { name: 'Itaú', initials: 'IT', color: '#EC7000', textColor: '#FFFFFF' };
  }
  if (norm.includes('inter')) {
    return { name: 'Inter', initials: 'IN', color: '#FF7A00', textColor: '#FFFFFF' };
  }
  if (norm.includes('bradesco')) {
    return { name: 'Bradesco', initials: 'BR', color: '#CC092F', textColor: '#FFFFFF' };
  }
  if (norm.includes('brasil') || norm.includes('bb')) {
    return { name: 'BB', initials: 'BB', color: '#003882', textColor: '#FCE000' };
  }
  if (norm.includes('santander')) {
    return { name: 'Santander', initials: 'SAN', color: '#EA1D2C', textColor: '#FFFFFF' };
  }
  if (norm.includes('caixa')) {
    return { name: 'Caixa', initials: 'CX', color: '#0066B3', textColor: '#FFFFFF' };
  }
  if (norm.includes('c6')) {
    return { name: 'C6 Bank', initials: 'C6', color: '#1B1B1B', textColor: '#FFFFFF' };
  }
  return {
    name: institutionName || 'Banco',
    initials: (institutionName || 'BK').slice(0, 2).toUpperCase(),
    color: '#0D9488',
    textColor: '#FFFFFF',
  };
}

export function partitionBankAccounts(accounts: FinanceAccount[]): {
  bankAccounts: FinanceAccount[];
  creditAccounts: FinanceAccount[];
  totalBankBalance: number;
} {
  const bankAccounts = accounts.filter(
    (a) => a.account_type === 'BANK' || !a.account_type
  );
  const creditAccounts = accounts.filter((a) => a.account_type === 'CREDIT');
  const totalBankBalance = bankAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  return {
    bankAccounts,
    creditAccounts,
    totalBankBalance,
  };
}
