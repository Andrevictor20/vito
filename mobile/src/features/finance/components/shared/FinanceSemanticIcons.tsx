import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BrandLogo } from '../../../../icons/IconRegistry';
import { getBankBrand } from '../../utils/bankBrands';
import { withHexAlpha } from '../../utils/financeHelpers';

/**
 * Paleta multicolorida oficial v5 dos gráficos financeiros (PAL / CPAL / GPAL de Vito-telas-atualizadas.html).
 * Garante contraste excelente em Light e Dark mode.
 */
const PALETTE_LIGHT = [
  '#2563EB', '#0B7A53', '#7C3AED', '#DC2626', '#D97706', '#0F766E', '#DB2777', '#0284C7',
] as const;

const PALETTE_DARK = [
  '#60A5FA', '#34D399', '#A78BFA', '#F87171', '#FBBF24', '#2DD4BF', '#F472B6', '#38BDF8',
] as const;

export function getFinanceChartPalette(isDark: boolean): readonly string[] {
  return isDark ? PALETTE_DARK : PALETTE_LIGHT;
}

export type CategoryIconKey =
  | 'home' | 'food' | 'transport' | 'delivery' | 'leisure' | 'health'
  | 'shopping' | 'subscriptions' | 'education' | 'income' | 'goal' | 'tag';

export interface CategoryVisual {
  color: string;
  bg: string;
  icon: CategoryIconKey;
}

export function resolveCategoryVisual(
  category: string | undefined,
  isDark: boolean,
  fallbackIndex = 0,
): CategoryVisual {
  const pal = getFinanceChartPalette(isDark);
  const c = (category || '').toLowerCase();
  const alpha = isDark ? 0.2 : 0.13;

  const pick = (color: string, icon: CategoryIconKey): CategoryVisual => ({
    color,
    bg: withHexAlpha(color, alpha),
    icon,
  });

  if (/(moradia|casa|aluguel|condom[ií]nio|luz|energia|[aá]gua|internet|iptu|housing|rent)/i.test(c)) {
    return pick(pal[0], 'home'); // blue
  }
  if (/(delivery|ifood|rappi|entrega)/i.test(c)) {
    return pick(pal[3], 'delivery'); // red
  }
  if (/(alimenta[cç][aã]o|mercado|supermercado|restaurante|padaria|caf[eé]|comida|food|grocer)/i.test(c)) {
    return pick(pal[1], 'food'); // emerald
  }
  if (/(transporte|mobilidade|uber|99|combust[ií]vel|gasolina|estacionamento|ped[aá]gio|carro|transport)/i.test(c)) {
    return pick(pal[2], 'transport'); // purple
  }
  if (/(lazer|entretenimento|cinema|viagem|bar|festa|jogo|game|hobby|leisure|travel)/i.test(c)) {
    return pick(pal[4], 'leisure'); // orange
  }
  if (/(sa[uú]de|farm[aá]cia|m[eé]dic|consulta|academia|esporte|dentista|health|gym)/i.test(c)) {
    return pick(pal[6], 'health'); // rose
  }
  if (/(assinatura|streaming|software|nuvem|servi[cç]o|subscription)/i.test(c)) {
    return pick(pal[4], 'subscriptions'); // orange
  }
  if (/(compra|vestu[aá]rio|roupa|eletr[oô]nico|shopping|loja|shop)/i.test(c)) {
    return pick(pal[7], 'shopping'); // sky blue
  }
  if (/(educa[cç][aã]o|curso|livro|faculdade|escola|education)/i.test(c)) {
    return pick(pal[2], 'education'); // purple
  }
  if (/(entrada|sal[aá]rio|renda|pix recebido|reembolso|investimento|rendimento|income|salary)/i.test(c)) {
    return pick(pal[1], 'income'); // emerald
  }

  const fallbackColor = pal[Math.abs(fallbackIndex) % pal.length];
  return pick(fallbackColor, 'tag');
}

const CategoryGlyph: React.FC<{ icon: CategoryIconKey; color: string; size: number }> = ({
  icon,
  color,
  size,
}) => {
  switch (icon) {
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'food':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 10h10v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M15 11h2a2 2 0 0 1 0 4h-2" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M8.5 5.5c0 1 .8 1.5.8 2.3M11.8 5c0 1 .8 1.5.8 2.3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case 'transport':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 14.5l1.5-5A2 2 0 0 1 8.4 8h7.2a2 2 0 0 1 1.9 1.5L19 14.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Rect x={4} y={13} width={16} height={5.5} rx={2} stroke={color} strokeWidth={2} />
          <Circle cx={7.8} cy={15.8} r={1.1} fill={color} />
          <Circle cx={16.2} cy={15.8} r={1.1} fill={color} />
        </Svg>
      );
    case 'delivery':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 8h12l-1 12H7L6 8z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'leisure':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
          <Path d="M8.5 14.2c1 1.5 2.2 2.1 3.5 2.1s2.5-.6 3.5-2.1" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={9.2} cy={10} r={1.1} fill={color} />
          <Circle cx={14.8} cy={10} r={1.1} fill={color} />
        </Svg>
      );
    case 'health':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 20s-7-4.4-8.6-8.4A5 5 0 0 1 12 6.8a5 5 0 0 1 8.6 4.8C19 15.6 12 20 12 20z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'shopping':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 7h12l1 13H5L6 7z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M9 7a3 3 0 0 1 6 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'subscriptions':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M17 2l4 4-4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M7 22l-4-4 4-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'education':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 7l9-4 9 4-9 4-9-4z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M7 9.5v5.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V9.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'income':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 4.5l4.2 4.2-4.2 4.2-4.2-4.2L12 4.5z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
          <Path d="M12 11.1l4.2 4.2-4.2 4.2-4.2-4.2 4.2-4.2z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
        </Svg>
      );
    case 'goal':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={2} />
          <Circle cx={12} cy={12} r={4.5} stroke={color} strokeWidth={2} />
          <Circle cx={12} cy={12} r={1.6} fill={color} />
        </Svg>
      );
    case 'tag':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V4h9l8.6 8.6a2 2 0 0 1 0 .8z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Circle cx={8} cy={8.5} r={1.3} fill={color} />
        </Svg>
      );
  }
};

export const CategorySemanticBadge: React.FC<{
  category?: string;
  isDark: boolean;
  index?: number;
  size?: number;
}> = ({ category, isDark, index = 0, size = 34 }) => {
  const vis = resolveCategoryVisual(category, isDark, index);
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          backgroundColor: vis.bg,
        },
      ]}
    >
      <CategoryGlyph icon={vis.icon} color={vis.color} size={Math.round(size * 0.54)} />
    </View>
  );
};

export const GoalSemanticBadge: React.FC<{
  title?: string;
  isDark: boolean;
  index?: number;
  size?: number;
}> = ({ title, isDark, index = 0, size = 34 }) => {
  const pal = getFinanceChartPalette(isDark);
  const gpal = [pal[5], pal[2], pal[0], pal[4], pal[1]];
  const color = gpal[Math.abs(index) % gpal.length];
  const t = (title || '').toLowerCase();
  const icon: CategoryIconKey = /(viagem|f[eé]rias|europa|disney)/i.test(t)
    ? 'leisure'
    : /(casa|apartamento|im[oó]vel)/i.test(t)
      ? 'home'
      : /(carro|moto|ve[ií]culo)/i.test(t)
        ? 'transport'
        : /(curso|estudo|faculdade|mba)/i.test(t)
          ? 'education'
          : 'goal';

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          backgroundColor: withHexAlpha(color, isDark ? 0.2 : 0.14),
        },
      ]}
    >
      <CategoryGlyph icon={icon} color={color} size={Math.round(size * 0.54)} />
    </View>
  );
};

type MerchantKey =
  | 'uber' | 'ifood' | 'netflix' | 'spotify' | 'googleone'
  | 'amazonprime' | 'smartfit' | 'shell' | 'padaria' | 'pix' | 'youtube';

export function detectMerchantKey(text?: string, isPix?: boolean): MerchantKey | null {
  const s = (text || '').toLowerCase();
  if (/uber/.test(s)) return 'uber';
  if (/ifood|i-food/.test(s)) return 'ifood';
  if (/netflix/.test(s)) return 'netflix';
  if (/spotify/.test(s)) return 'spotify';
  if (/google\s*one|google\s*play|google\s*storage/.test(s)) return 'googleone';
  if (/amazon|prime\s*video/.test(s)) return 'amazonprime';
  if (/smart\s*fit|bluefit|academia/.test(s)) return 'smartfit';
  if (/shell|ipiranga|petrobras|posto/.test(s)) return 'shell';
  if (/padaria|panificadora|starbucks|caf[eé]/.test(s)) return 'padaria';
  if (/youtube/.test(s)) return 'youtube';
  if (isPix || /\bpix\b/.test(s)) return 'pix';
  return null;
}

const MERCHANT_BG: Record<MerchantKey, string> = {
  uber: '#111111',
  ifood: '#EA1D2C',
  netflix: '#141414',
  spotify: '#1DB954',
  googleone: '#F4F4F4',
  amazonprime: '#00A8E1',
  smartfit: '#1B1B1B',
  shell: '#FBCE07',
  padaria: '#FDEEDB',
  pix: '#E3F6EC',
  youtube: '#FF0000',
};

const MerchantBrandGlyph: React.FC<{ brand: MerchantKey; size: number }> = ({ brand, size }) => {
  switch (brand) {
    case 'uber':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M8.4 7.5v5.1a3.6 3.6 0 0 0 7.2 0V7.5" stroke="#FFF" strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx={12} cy={17.2} r={1.2} fill="#FFF" />
        </Svg>
      );
    case 'ifood':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={9.2} cy={9.2} r={1.3} fill="#FFF" />
          <Circle cx={14.8} cy={9.2} r={1.3} fill="#FFF" />
          <Path d="M7.2 13.4c1.3 2.3 3 3.2 4.8 3.2 2.2 0 4-1.3 5.2-3.5" stroke="#FFF" strokeWidth={2.1} strokeLinecap="round" />
          <Path d="M15.4 13.2l2.4-.4-.7 2.3" stroke="#FFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'netflix':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M7.2 19V5h2.7l4.2 8.7V5h2.7v14h-2.6l-4.3-8.8V19H7.2z" fill="#E50914" />
        </Svg>
      );
    case 'spotify':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6.4 9.5c3.7-1.1 7.9-.9 11.4.7" stroke="#FFF" strokeWidth={2.1} strokeLinecap="round" />
          <Path d="M7.4 13c3-.9 6.3-.7 9.1.6" stroke="#FFF" strokeWidth={1.9} strokeLinecap="round" />
          <Path d="M8.5 16.2c2.2-.6 4.7-.4 6.8.5" stroke="#FFF" strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    case 'googleone':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12.2 6.8v10.4" stroke="#4285F4" strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M8.5 9.8l3.7-3" stroke="#EA4335" strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M8.5 9.8v4.1" stroke="#FBBC04" strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M9.6 17.2h5.2" stroke="#34A853" strokeWidth={2.8} strokeLinecap="round" />
        </Svg>
      );
    case 'amazonprime':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6.5 13.5c3.2 2.4 7.7 2.4 10.9.1" stroke="#FFF" strokeWidth={2.1} strokeLinecap="round" />
          <Path d="M15.6 12.6l2.3.7-.6 2.2" stroke="#FFF" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8.5 9.2h7" stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'smartfit':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 9v6M18 9v6M3.5 10.5v3M20.5 10.5v3M6 12h12" stroke="#FFB800" strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      );
    case 'shell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 4.8l6.2 4.6-2 9.4H7.8l-2-9.4L12 4.8z" stroke="#DD1D21" strokeWidth={2} strokeLinejoin="round" />
          <Path d="M12 8.5v7.5M9.5 10l2.5 6M14.5 10L12 16" stroke="#DD1D21" strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'padaria':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 10h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5z" stroke="#F08300" strokeWidth={1.9} />
          <Path d="M16 11h1.8a2.2 2.2 0 0 1 0 4.4H16" stroke="#F08300" strokeWidth={1.9} />
          <Path d="M8.5 5.5c0 1.2.9 1.6.9 2.5M12 5c0 1.2.9 1.6.9 2.5" stroke="#F08300" strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    case 'youtube':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="#FFF" />
        </Svg>
      );
    case 'pix':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 4.5l4.2 4.2-4.2 4.2-4.2-4.2L12 4.5z" stroke="#0AA55C" strokeWidth={1.9} strokeLinejoin="round" />
          <Path d="M12 11.1l4.2 4.2-4.2 4.2-4.2-4.2 4.2-4.2z" stroke="#0AA55C" strokeWidth={1.9} strokeLinejoin="round" />
        </Svg>
      );
  }
};

export const TransactionSemanticBadge: React.FC<{
  merchant?: string;
  category?: string;
  isCredit?: boolean;
  isPix?: boolean;
  isDark: boolean;
  index?: number;
  size?: number;
}> = ({ merchant, category, isCredit = false, isPix = false, isDark, index = 0, size = 38 }) => {
  const brand = detectMerchantKey(merchant, isPix && isCredit);
  if (brand) {
    return (
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.32),
            backgroundColor: MERCHANT_BG[brand],
          },
        ]}
      >
        <MerchantBrandGlyph brand={brand} size={Math.round(size * 0.58)} />
      </View>
    );
  }

  return (
    <CategorySemanticBadge
      category={isCredit ? 'Entrada' : category}
      isDark={isDark}
      index={index}
      size={size}
    />
  );
};

export function resolveBankLogoId(name?: string): string | null {
  const n = (name || '').toLowerCase();
  if (n.includes('nubank') || n.includes('nu ')) return 'Nubank';
  if (n.includes('itaú') || n.includes('itau')) return 'Itaú';
  if (n.includes('inter')) return 'Inter';
  if (n.includes('brasil') || n === 'bb') return 'Banco do Brasil';
  if (n.includes('bradesco')) return 'Bradesco';
  if (n.includes('santander')) return 'Santander';
  if (n.includes('c6')) return 'C6 Bank';
  if (n.includes('caixa')) return 'Caixa';
  return null;
}

export const FinanceBankBadge: React.FC<{
  institutionName?: string;
  size?: number;
  rounded?: boolean;
}> = ({ institutionName, size = 38, rounded = false }) => {
  const brand = getBankBrand(institutionName);
  const logoId = resolveBankLogoId(institutionName || brand.name);

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: rounded ? Math.round(size / 2) : Math.round(size * 0.36),
          backgroundColor: brand.color,
        },
      ]}
    >
      {logoId ? (
        <BrandLogo group="bank" id={logoId} size={Math.round(size * 0.58)} color={brand.textColor} />
      ) : (
        <Text style={[styles.bankInitials, { color: brand.textColor }]}>{brand.initials}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bankInitials: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 12,
    fontWeight: '700',
  },
});
