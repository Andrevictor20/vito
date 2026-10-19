import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { X, MessageSquare, Loader2, ArrowRight } from 'lucide-react';

interface WhatsAppAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppAuthModal: React.FC<WhatsAppAuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithWhatsApp } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('phone');
    setCode('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Informe um número de telefone celular válido com DDD.');
      return;
    }

    setLoading(true);
    try {
      await api.requestWhatsAppOTP(cleanPhone);
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar código via WhatsApp. Verifique o número.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('O código de verificação deve ter 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      await loginWithWhatsApp(cleanPhone, cleanCode);
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Código incorreto ou expirado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-[28px] p-7 shadow-2xl relative transition-colors duration-200">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Entrar com WhatsApp</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Acesso rápido e seguro sem precisar digitar senha
          </p>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-3.5 bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#222730] rounded-xl mb-5">
          <MessageSquare className="w-5 h-5 text-[#25D366] shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {step === 'phone'
              ? 'Enviaremos um código numérico de 6 dígitos para o seu WhatsApp oficial.'
              : `Digite o código de 6 dígitos enviado para ${phone}.`}
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleRequestOTP} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Número do WhatsApp com DDD
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 11988887777"
                disabled={loading}
                className="w-full h-12 px-4 rounded-lg bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white dark:text-[#09090B]" />
              ) : (
                <>
                  <span>Enviar Código</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Código de 6 dígitos
              </label>
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
                disabled={loading}
                className="w-full h-12 px-4 text-center tracking-[0.3em] font-mono text-lg rounded-lg bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white dark:text-[#09090B]" />
              ) : (
                'Confirmar e Entrar'
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-center"
            >
              Alterar número de telefone
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
