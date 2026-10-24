import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

interface AuthEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRegisterMode?: boolean;
}

export const AuthEmailModal: React.FC<AuthEmailModalProps> = ({
  isOpen,
  onClose,
  initialRegisterMode = false,
}) => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(initialRegisterMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setIsRegister(initialRegisterMode);
  }, [initialRegisterMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !password || (isRegister && !cleanName)) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(cleanName, cleanEmail, password);
      } else {
        await login(cleanEmail, password);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
    >
      <div className="w-full max-w-[420px] bg-white dark:bg-[#191c1e] border border-[#d2d7d4] dark:border-[#2c3134] rounded-[28px] p-7 shadow-2xl relative transition-all">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-display font-extrabold text-2xl text-[#17191b] dark:text-[#f1f3f2] tracking-tight mb-2">
          {isRegister ? 'Criar Conta' : 'Entrar com e-mail'}
        </h2>
        <p className="text-xs text-[#69706d] dark:text-[#98a19d] mb-6">
          {isRegister
            ? 'Cadastre-se para sincronizar seus compromissos com segurança.'
            : 'Digite suas credenciais para acessar sua conta Vito.'}
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[#d6355a] dark:text-[#ff6b8a] text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-[#69706d] dark:text-[#98a19d] mb-1.5">
                Nome Completo
              </label>
              <input
                type="text"
                placeholder="Ex: André Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="w-full h-12 px-4 rounded-xl bg-[#f2f4f3] dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] text-[#17191b] dark:text-[#f1f3f2] focus:outline-none focus:border-[#17191b] dark:focus:border-[#f1f3f2] text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#69706d] dark:text-[#98a19d] mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full h-12 px-4 rounded-xl bg-[#f2f4f3] dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] text-[#17191b] dark:text-[#f1f3f2] focus:outline-none focus:border-[#17191b] dark:focus:border-[#f1f3f2] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#69706d] dark:text-[#98a19d] mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full h-12 pl-4 pr-11 rounded-xl bg-[#f2f4f3] dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] text-[#17191b] dark:text-[#f1f3f2] focus:outline-none focus:border-[#17191b] dark:focus:border-[#f1f3f2] text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#17191b] hover:bg-black dark:bg-[#f1f3f2] dark:hover:bg-white text-white dark:text-[#0d0f10] font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRegister ? (
              'Cadastrar'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="text-center mt-5">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-[#69706d] dark:text-[#98a19d] hover:text-[#17191b] dark:hover:text-[#f1f3f2] transition-colors"
          >
            {isRegister
              ? 'Já possui uma conta? Faça login'
              : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
};
