import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { VitoAnimatedLogo } from './VitoAnimatedLogo';
import { HeadlineReel } from './HeadlineReel';
import { DemoStage } from './DemoStage';
import { AuthEmailModal } from './AuthEmailModal';
import { WhatsAppAuthModal } from './WhatsAppAuthModal';
import { GoogleIcon } from '../common/GoogleIcon';
import { Mail, MessageSquare, Sun, Moon, AlertCircle, RefreshCw } from 'lucide-react';
import { getDesktopDeviceName } from '../../services/api';

export const AuthView: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showWhatsAppAuth, setShowWhatsAppAuth] = useState(false);
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

  const handleGoogleLogin = () => {
    setOauthError(null);
    const redirectUrl = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const deviceName = encodeURIComponent(getDesktopDeviceName());
    const apiBase = (import.meta as any).env?.VITE_API_URL || '';
    window.location.href = `${apiBase}/api/v1/auth/google/start?mode=login&redirect_scheme=${redirectUrl}&device_name=${deviceName}`;
  };

  const openEmailAuth = (register = false) => {
    setIsRegisterMode(register);
    setShowEmailModal(true);
  };

  return (
    <main className="min-h-screen w-full bg-[#dde1df] dark:bg-[#050606] text-[#17191b] dark:text-[#f1f3f2] flex items-center justify-center p-4 sm:p-6 lg:p-12 transition-colors duration-200">
      {/* Container Widescreen Principal com Moldura Sofisticada */}
      <div className="w-full max-w-[1240px] min-h-[640px] rounded-[32px] bg-[#ffffff] dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] shadow-vito-elevated grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* COLUNA ESQUERDA: Login e Apresentação (5 Colunas Widescreen) */}
        <section className="lg:col-span-5 p-8 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#d2d7d4] dark:border-[#2c3134]">
          {/* Topbar: Logo e Alternador de Tema */}
          <div className="flex items-center justify-between">
            <VitoAnimatedLogo size={38} showWordmark={true} />

            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#f2f4f3] dark:bg-[#191c1e] border border-[#d2d7d4] dark:border-[#2c3134] text-[#69706d] dark:text-[#98a19d] hover:text-[#17191b] dark:hover:text-[#f1f3f2] hover:scale-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
              aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Área Central: HeadlineReel e Chamada de Valor */}
          <div className="my-8 lg:my-auto">
            <div className="select-none mb-3">
              <span className="block font-display font-extrabold text-[24px] sm:text-[28px] text-[#69706d] dark:text-[#98a19d]">
                Seu assistente para
              </span>
              <div className="text-[32px] sm:text-[38px] lg:text-[42px] leading-[1.2]">
                <HeadlineReel currentIndex={currentSceneIndex} />
              </div>
            </div>

            <p className="mt-5 text-sm sm:text-base text-[#69706d] dark:text-[#98a19d] leading-relaxed max-w-sm">
              Seu secretário executivo com IA para organizar compromissos, triar e-mails urgentes e monitorar informações essenciais sem atrito.
            </p>

            {oauthError && (
              <div className="mt-5 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[#d6355a] dark:text-[#ff6b8a] text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{oauthError}</span>
              </div>
            )}

            {/* Pílula de Login Canônica (Google, WhatsApp, E-mail) */}
            <div className="mt-8 flex flex-col items-center sm:items-start">
              <div
                className="inline-flex items-center gap-3 p-2 bg-[#f2f4f3] dark:bg-[#191c1e] border border-[#d2d7d4] dark:border-[#2c3134] rounded-full shadow-vito-card"
                role="group"
                aria-label="Opções de autenticação"
              >
                {/* Botão Google */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-14 h-14 rounded-full bg-white flex items-center justify-center border border-zinc-200/80 shadow-sm hover:scale-105 active:scale-95 transition-all"
                  title="Continuar com o Google"
                  aria-label="Continuar com o Google"
                >
                  <GoogleIcon size={24} />
                </button>

                {/* Botão WhatsApp */}
                <button
                  type="button"
                  onClick={() => setShowWhatsAppAuth(true)}
                  className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all"
                  title="Entrar com WhatsApp"
                  aria-label="Entrar com WhatsApp"
                >
                  <MessageSquare className="w-6 h-6 fill-current" />
                </button>

                {/* Botão E-mail */}
                <button
                  type="button"
                  onClick={() => openEmailAuth(false)}
                  className="w-14 h-14 rounded-full bg-[#17191b] dark:bg-[#f1f3f2] text-white dark:text-[#0d0f10] flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all"
                  title="Entrar com E-mail"
                  aria-label="Entrar com E-mail"
                >
                  <Mail className="w-6 h-6" />
                </button>
              </div>

              {/* Alternador de Cadastro */}
              <button
                type="button"
                onClick={() => openEmailAuth(true)}
                className="mt-4 text-xs font-semibold text-[#17191b] dark:text-[#f1f3f2] hover:underline transition-all"
              >
                Não tem conta? Cadastre-se
              </button>
            </div>
          </div>

          {/* Rodapé Executivo */}
          <div className="flex items-center justify-between pt-6 border-t border-[#d2d7d4]/60 dark:border-[#2c3134]/60 text-xs text-[#69706d] dark:text-[#98a19d]">
            <span className="font-mono text-[11px]">Build: v0.2.0</span>
            <div className="flex items-center gap-1.5 font-medium">
              <RefreshCw className="w-3.5 h-3.5 text-[#00E599]" />
              <span>Sincronizado</span>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: Demonstração Interativa DemoStage (7 Colunas Widescreen) */}
        <section className="lg:col-span-7 p-6 sm:p-10 lg:p-12 bg-[#dde1df]/40 dark:bg-[#050606]/60 flex items-center justify-center relative">
          <div className="w-full max-w-[560px]">
            <DemoStage
              currentIndex={currentSceneIndex}
              onSceneChange={setCurrentSceneIndex}
            />
          </div>
        </section>
      </div>

      {/* Modais de Autenticação */}
      <AuthEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        initialRegisterMode={isRegisterMode}
      />

      <WhatsAppAuthModal
        isOpen={showWhatsAppAuth}
        onClose={() => setShowWhatsAppAuth(false)}
      />
    </main>
  );
};
