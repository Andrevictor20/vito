/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Canônico Vito Design System (vito-telas.html e tokens.ts)
        page: {
          light: '#dde1df',
          dark: '#050606',
        },
        canvas: {
          light: '#ffffff',
          dark: '#0d0f10',
        },
        surf: {
          DEFAULT: '#14171C',
          light: '#f2f4f3',
          dark: '#191c1e',
          elevated: '#1f2328',
          overlay: '#282d33',
        },
        line: {
          light: '#e1e5e3',
          dark: '#2c3134',
        },
        ink: {
          light: '#17191b',
          dark: '#f1f3f2',
        },
        muted: {
          light: '#6d7471',
          dark: '#8b928f',
        },
        acc: {
          DEFAULT: '#00E599',
          light: '#0b9a5f',
          dark: '#34d399',
          emerald: '#059669',
        },
        blue: {
          DEFAULT: '#2563EB',
          light: '#2563EB',
          dark: '#3B82F6',
          bgLight: '#EFF6FF',
          bgDark: 'rgba(59, 130, 246, 0.16)',
        },
        red: {
          DEFAULT: '#DC2626',
          light: '#DC2626',
          dark: '#EF4444',
          bgLight: '#FEF2F2',
          bgDark: 'rgba(239, 68, 68, 0.16)',
        },
        purple: {
          DEFAULT: '#7C3AED',
          light: '#7C3AED',
          dark: '#8B5CF6',
          bgLight: '#F5F3FF',
          bgDark: 'rgba(139, 92, 246, 0.16)',
        },
        amber: {
          DEFAULT: '#D97706',
          light: '#D97706',
          dark: '#F59E0B',
        },
        background: '#0B0D10',
        surface: {
          DEFAULT: '#14171C',
          elevated: '#1C2026',
          overlay: '#262B33',
          highest: '#313742',
        },
        hairline: 'rgba(255, 255, 255, 0.08)',
        brand: {
          primary: '#00E599',
          primaryLight: '#34D399',
          emerald: '#10B981',
          emeraldLight: '#34D399',
          rose: '#F43F5E',
          amber: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 0 24px -4px rgba(0, 229, 153, 0.25)',
        'glow-emerald': '0 0 24px -4px rgba(16, 185, 129, 0.25)',
        'modal': '0 20px 40px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'vito-card': '0 6px 22px rgba(20, 25, 22, 0.14)',
        'vito-elevated': '0 20px 48px -10px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
