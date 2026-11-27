export function formatBRL(val: number, decimals = 2): string {
  const safe = Number.isFinite(val) ? Math.abs(val) : 0;
  return `R$ ${safe.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function maskBRL(hidden: boolean, formatted: string): string {
  return hidden ? 'R$ ••••' : formatted;
}
