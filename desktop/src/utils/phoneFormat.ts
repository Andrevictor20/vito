/**
 * Helpers para formatação e sanitização de números de telefone no Desktop.
 */

export const cleanPhoneNumber = (raw: string): string => {
  if (!raw) return '';
  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
};

export const formatPhoneNumber = (raw: string): string => {
  if (!raw) return '';
  const cleaned = cleanPhoneNumber(raw);
  const hasPlus = cleaned.startsWith('+');
  const digits = cleaned.replace(/\D/g, '');

  // Padrão Brasil com DDI +55: +55 (XX) XXXXX-XXXX ou +55 (XX) XXXX-XXXX
  if (hasPlus && digits.startsWith('55') && digits.length >= 4) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length <= 4) {
      return `+55 (${ddd}) ${rest}`;
    }
    if (rest.length <= 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
  }

  // Padrão nacional 10 ou 11 dígitos: (XX) XXXXX-XXXX
  if (!hasPlus && (digits.length === 10 || digits.length === 11)) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (digits.length === 11) {
      return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  // Se já tiver +, formata minimamente
  if (hasPlus) {
    return `+${digits}`;
  }

  return raw;
};

export const isValidPhoneNumber = (raw: string): boolean => {
  if (!raw) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

export const toE164Phone = (raw: string): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (hasPlus) {
    if (digits.startsWith('550') && (digits.length === 13 || digits.length === 14)) {
      digits = '55' + digits.slice(3);
    }
    if (digits.length >= 8 && digits.length <= 15) {
      return `+${digits}`;
    }
    return '';
  }

  if (digits.startsWith('00') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0') && (digits.length === 13 || digits.length === 14)) {
    digits = digits.slice(3);
  }

  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  if (digits.length >= 12 && digits.length <= 15) {
    return `+${digits}`;
  }

  return '';
};
