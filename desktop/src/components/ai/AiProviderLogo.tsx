import React from 'react';
import { AiProviderKey } from '../../types';

interface AiProviderLogoProps {
  providerKey: AiProviderKey;
  size?: number;
  className?: string;
}

export const AiProviderLogo: React.FC<AiProviderLogoProps> = ({
  providerKey,
  size = 36,
  className = '',
}) => {
  const style = { width: size, height: size };

  switch (providerKey) {
    case 'srv':
      return (
        <svg viewBox="0 0 256 256" style={style} className={`shrink-0 rounded-xl ${className}`} aria-hidden="true">
          <rect width="256" height="256" rx="64" fill="#141416" />
          <path
            fill="#fff"
            d="M128 46c-34 0-58 24-58 58v36c0 16-8 25-20 30-7 3-10 11-6 18 4 7 12 10 19 6 10-5 19-13 24-22 3 16 14 29 29 29 8 0 15-4 19-10 4 6 11 10 19 10 15 0 26-13 29-29 5 9 14 17 24 22 7 4 15 1 19-6 4-7 1-15-6-18-12-5-20-14-20-30v-36c0-34-24-58-58-58z"
          />
          <rect x="101" y="92" width="14" height="28" rx="7" fill="#141416" />
          <rect x="141" y="92" width="14" height="28" rx="7" fill="#141416" />
        </svg>
      );
    case 'anthropic':
      return (
        <svg viewBox="0 0 256 256" style={style} className={`shrink-0 rounded-xl ${className}`} aria-hidden="true">
          <rect width="256" height="256" rx="64" fill="#D97757" />
          <path
            stroke="#fff"
            strokeWidth="20"
            strokeLinecap="round"
            d="M128 46v164M46 128h164M70 70l116 116M186 70L70 186"
          />
          <circle cx="128" cy="128" r="24" fill="#D97757" />
        </svg>
      );
    case 'google':
      return (
        <svg viewBox="0 0 256 256" style={style} className={`shrink-0 rounded-xl ${className}`} aria-hidden="true">
          <path
            fill="#4285F4"
            d="M128 24c6 58 46 98 104 104-58 6-98 46-104 104-6-58-46-98-104-104 58-6 98-46 104-104z"
          />
          <path fill="#8AB4F8" d="M128 24c6 58 46 98 104 104h-104V24z" />
          <path fill="#5E97F6" d="M128 128H24c58-6 98-46 104-104v104z" />
        </svg>
      );
    case 'openai':
      return (
        <svg viewBox="0 0 256 256" style={style} className={`shrink-0 rounded-xl ${className}`} aria-hidden="true">
          <rect width="256" height="256" rx="64" fill="#10A37F" />
          <g fill="none" stroke="#fff" strokeWidth="14" strokeLinejoin="round">
            <circle cx="128" cy="86" r="32" />
            <circle cx="164" cy="107" r="32" />
            <circle cx="164" cy="149" r="32" />
            <circle cx="128" cy="170" r="32" />
            <circle cx="92" cy="149" r="32" />
            <circle cx="92" cy="107" r="32" />
          </g>
          <circle cx="128" cy="128" r="18" fill="#10A37F" />
        </svg>
      );
    case 'groq':
      return (
        <svg viewBox="0 0 256 256" style={style} className={`shrink-0 rounded-xl ${className}`} aria-hidden="true">
          <rect width="256" height="256" rx="64" fill="#F55036" />
          <path fill="#fff" d="M142 48L66 140h54l-14 68 84-96h-54l6-64z" />
        </svg>
      );
    case 'openrouter':
      return (
        <svg viewBox="0 0 256 256" style={style} className={`shrink-0 rounded-xl ${className}`} aria-hidden="true">
          <rect width="256" height="256" rx="64" fill="#6366F1" />
          <path
            fill="none"
            stroke="#fff"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M62 128h44c18 0 24-44 46-44h42M106 128c18 0 24 44 46 44h42M174 66l24 18-24 18M174 154l24 18-24 18"
          />
          <circle cx="62" cy="128" r="16" fill="#fff" />
        </svg>
      );
    case 'custom':
    default:
      return (
        <svg viewBox="0 0 256 256" style={style} className={`shrink-0 rounded-xl ${className}`} aria-hidden="true">
          <rect width="256" height="256" rx="64" fill="#0D9488" />
          <path
            fill="none"
            stroke="#fff"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M92 86L50 128l42 42M164 86l42 42-42 42M140 72l-24 112"
          />
        </svg>
      );
  }
};

export const AiProviderLogoStack: React.FC<{ providerKeys: AiProviderKey[] }> = ({
  providerKeys,
}) => {
  const visible = providerKeys.slice(0, 3);
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((key) => (
        <div
          key={key}
          className="rounded-lg ring-2 ring-[var(--bg)] bg-[var(--bg)] overflow-hidden"
        >
          <AiProviderLogo providerKey={key} size={24} />
        </div>
      ))}
    </div>
  );
};
