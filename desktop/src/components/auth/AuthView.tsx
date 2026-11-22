import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { VitoAnimatedLogo } from './VitoAnimatedLogo';
import { HeadlineReel } from './HeadlineReel';
import { DemoStage } from './DemoStage';
import { AuthEmailModal } from './AuthEmailModal';
import { WhatsAppAuthModal } from './WhatsAppAuthModal';
import { LegalDocModal, type LegalDocKind } from './LegalDocModal';
import {
  OnboardingView,
  hasSeenDesktopOnboarding,
} from './OnboardingView';
import { DEMO_SCENES, getToneColor } from './demoScenes';
import { loginPalette } from './loginPalette';
import { GoogleIcon } from '../common/GoogleIcon';
import { Mail, Sun, Moon, AlertCircle } from 'lucide-react';
import { getDesktopDeviceName } from '../../services/api';

export const AuthView: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const palette = loginPalette(isDark);

  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !hasSeenDesktopOnboarding());
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showWhatsAppAuth, setShowWhatsAppAuth] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocKind | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error') || params.get('err');
      if (err) {
        setOauthError(`Falha na autenticação: ${decodeURIComponent(err)}`);
      }
    }
  }, []);

  if (showOnboarding) {
    return <OnboardingView onComplete={() => setShowOnboarding(false)} />;
  }

  const currentScene = DEMO_SCENES[currentSceneIndex] || DEMO_SCENES[0];
  const activeGlowColor = getToneColor(currentScene.tone, isDark);

  const handleGoogleLogin = () => {
    setOauthError(null);
    const redirectUrl = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const deviceName = encodeURIComponent(getDesktopDeviceName());
    const apiBase = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || '';
    window.location.href = `${apiBase}/api/v1/auth/google/start?mode=login&redirect_scheme=${redirectUrl}&device_name=${deviceName}`;
  };

  return (
    <main
      id="s-login"
      style={{ backgroundColor: palette.page, color: palette.ink }}
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-10 transition-colors duration-200"
    >
      <div
        style={{ backgroundColor: palette.bg, borderColor: palette.hairline }}
        className="relative w-full max-w-[1160px] min-h-[640px] rounded-[32px] border shadow-2xl grid grid-cols-1 lg:grid-cols-12 overflow-hidden"
      >
        <div
          aria-hidden="true"
          style={{
            backgroundColor: activeGlowColor,
            opacity: isDark ? 0.18 : 0.13,
          }}
          className="pointer-events-none absolute top-[12%] left-[35%] w-[360px] h-[360px] rounded-full blur-[72px] transition-colors duration-700 z-0"
        />

        <section
          style={{ borderColor: palette.hairline }}
          className="relative z-10 lg:col-span-5 p-7 sm:p-9 lg:p-11 flex flex-col justify-between border-b lg:border-b-0 lg:border-r"
        >
          <div className="flex items-center justify-between">
            <VitoAnimatedLogo size={38} state="blink" showWordmark />

            <button
              type="button"
              id="lg-th-tgl"
              onClick={toggleTheme}
              style={{
                backgroundColor: palette.surf,
                borderColor: palette.line,
                color: palette.ink,
              }}
              className="w-10 h-10 rounded-full border flex items-center justify-center hover:scale-105 transition-all"
              title={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
              aria-label="Alternar tema claro ou escuro"
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
          </div>

          <div className="my-8 lg:my-auto">
            <div className="select-none">
              <span
                style={{ color: palette.muted }}
                className="block font-medium text-[21px] sm:text-[23px] mb-1"
              >
                Seu assistente para
              </span>
              <h1 className="text-[28px] sm:text-[34px] lg:text-[36px] leading-[1.2] font-bold tracking-[-0.035em]">
                <HeadlineReel currentIndex={currentSceneIndex} />
              </h1>
            </div>

            {oauthError && (
              <div
                style={{ backgroundColor: palette.redBg, color: palette.red }}
                className="mt-5 flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{oauthError}</span>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-2.5">
              <button
                type="button"
                id="lg-google"
                onClick={handleGoogleLogin}
                style={{ backgroundColor: palette.ink, color: palette.bg }}
                className="w-full h-[52px] rounded-full font-semibold text-[15px] tracking-[-0.01em] flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.14)] hover:opacity-90 active:scale-[0.985] transition-all"
              >
                <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                  <GoogleIcon size={15} />
                </span>
                <span>Continuar com Google</span>
              </button>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  id="lg-wa"
                  onClick={() => setShowWhatsAppAuth(true)}
                  style={{
                    backgroundColor: palette.surf,
                    borderColor: palette.hairline,
                    color: palette.ink,
                  }}
                  className="flex-1 h-12 rounded-full border font-medium text-sm flex items-center justify-center gap-2 hover:opacity-85 active:scale-[0.985] transition-all"
                >
                  <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="#25d366">
                    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-1.4-.7-2.4-1.3-3.3-2.9-.2-.3.2-.3.7-1.1.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.8.8-1 1.7-.9 2.7.2 1.1.7 2.1 1.4 3 1.2 1.7 2.7 2.8 4.5 3.5 1.6.6 2.2.5 3 .4.9-.1 1.8-.8 2-1.5.2-.6.2-1.2.1-1.3-.1-.1-.2-.2-.5-.3z" />
                  </svg>
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  id="lg-mail"
                  onClick={() => setShowEmailModal(true)}
                  style={{
                    backgroundColor: palette.surf,
                    borderColor: palette.hairline,
                    color: palette.ink,
                  }}
                  className="flex-1 h-12 rounded-full border font-medium text-sm flex items-center justify-center gap-2 hover:opacity-85 active:scale-[0.985] transition-all"
                >
                  <Mail className="w-[18px] h-[18px]" />
                  <span>E-mail</span>
                </button>
              </div>
            </div>
          </div>

          <p style={{ color: palette.muted }} className="text-[11.5px] leading-relaxed text-center lg:text-left">
            Ao continuar, você concorda com os{' '}
            <button
              type="button"
              onClick={() => setLegalDoc('terms')}
              style={{ color: palette.ink }}
              className="font-semibold underline underline-offset-2"
            >
              Termos de Uso
            </button>{' '}
            e a{' '}
            <button
              type="button"
              onClick={() => setLegalDoc('priv')}
              style={{ color: palette.ink }}
              className="font-semibold underline underline-offset-2"
            >
              Política de Privacidade
            </button>
            . Uso a partir de 13 anos.
          </p>
        </section>

        <section
          style={{ backgroundColor: palette.surf }}
          className="relative z-10 lg:col-span-7 p-6 sm:p-9 lg:p-10 flex items-center justify-center"
        >
          <div className="w-full max-w-[520px]">
            <DemoStage
              currentIndex={currentSceneIndex}
              onSceneChange={setCurrentSceneIndex}
            />
          </div>
        </section>
      </div>

      <AuthEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        initialRegisterMode={false}
      />

      <WhatsAppAuthModal
        isOpen={showWhatsAppAuth}
        onClose={() => setShowWhatsAppAuth(false)}
      />

      <LegalDocModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </main>
  );
};
