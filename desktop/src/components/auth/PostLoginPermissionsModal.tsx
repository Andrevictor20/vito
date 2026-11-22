import React, { useState } from 'react';
import { Bell, Calendar, Mic, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { loginPalette } from './loginPalette';

export const DESKTOP_PERMS_PROMPTED_KEY = 'vito_post_login_perms_prompted';
export const DESKTOP_PERMS_PREFS_KEY = 'vito_post_login_perms_prefs';

export interface DesktopPermPrefs {
  notif: boolean;
  cal: boolean;
  mic: boolean;
}

export function hasPromptedDesktopPerms(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(DESKTOP_PERMS_PROMPTED_KEY) === '1';
  } catch {
    return false;
  }
}

export interface PostLoginPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PostLoginPermissionsModal: React.FC<PostLoginPermissionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isDark } = useTheme();
  const palette = loginPalette(isDark);
  const [prefs, setPrefs] = useState<DesktopPermPrefs>({
    notif: true,
    cal: true,
    mic: false,
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggle = (key: keyof DesktopPermPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (prefs.notif && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission().catch(() => undefined);
        }
      }
      if (
        prefs.mic &&
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices?.getUserMedia
      ) {
        const stream = await navigator.mediaDevices
          .getUserMedia({ audio: true })
          .catch(() => null);
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(DESKTOP_PERMS_PROMPTED_KEY, '1');
        localStorage.setItem(DESKTOP_PERMS_PREFS_KEY, JSON.stringify(prefs));
      }
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  const rows: {
    key: keyof DesktopPermPrefs;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'notif',
      title: 'Notificações',
      subtitle: 'Avisar sobre eventos e tarefas',
      icon: <Bell className="w-5 h-5" />,
    },
    {
      key: 'cal',
      title: 'Calendário',
      subtitle: 'Sincronizar sua agenda',
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      key: 'mic',
      title: 'Microfone',
      subtitle: 'Falar com o Vito por voz',
      icon: <Mic className="w-5 h-5" />,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Permitir acesso?"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm select-none"
    >
      <div
        style={{ backgroundColor: palette.bg, borderColor: palette.hairline, color: palette.ink }}
        className="w-full max-w-[420px] rounded-[28px] border p-6 shadow-2xl relative"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight">Permitir acesso?</h2>
            <p style={{ color: palette.muted }} className="text-[13.5px] mt-0.5">
              Você pode mudar isso depois em Privacidade e dados
            </p>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            aria-label="Fechar"
            style={{ backgroundColor: palette.btn, color: palette.ink }}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:opacity-80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          style={{ backgroundColor: palette.surf, borderColor: palette.hairline }}
          className="rounded-[22px] border overflow-hidden"
        >
          {rows.map((row, idx) => {
            const on = prefs[row.key];
            return (
              <div
                key={row.key}
                style={{
                  borderTop: idx > 0 ? `1px solid ${palette.line}` : undefined,
                }}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <span className="shrink-0">{row.icon}</span>
                <div className="flex-1 min-w-0">
                  <b className="block text-[14.5px] font-medium">{row.title}</b>
                  <small style={{ color: palette.muted }} className="block text-xs mt-0.5">
                    {row.subtitle}
                  </small>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={row.title}
                  onClick={() => toggle(row.key)}
                  style={{
                    backgroundColor: on ? palette.acc : palette.line,
                  }}
                  className="w-11 h-6 rounded-full p-0.5 transition-colors relative shrink-0"
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      on ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ color: palette.muted }} className="text-[11.5px] leading-relaxed mt-3">
          O sistema pedirá confirmação para cada permissão.
        </p>

        <button
          type="button"
          onClick={handleContinue}
          disabled={submitting}
          style={{ backgroundColor: palette.ink, color: palette.bg }}
          className="w-full h-[52px] rounded-full font-semibold text-[15px] mt-4 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </div>
  );
};
