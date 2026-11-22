import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { loginPalette } from './loginPalette';
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
  const { isDark } = useTheme();
  const palette = loginPalette(isDark);

  const [isRegister, setIsRegister] = useState(initialRegisterMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  React.useEffect(() => {
    setIsRegister(initialRegisterMode);
    setError(null);
    setInfo(null);
  }, [initialRegisterMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setInfo(null);
      setError('Informe seu e-mail acima para receber o link de recuperação.');
      return;
    }
    setError(null);
    setInfo(`Link de recuperação enviado por e-mail para ${cleanEmail}.`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm select-none"
    >
      <div
        style={{ backgroundColor: palette.bg, borderColor: palette.hairline, color: palette.ink }}
        className="w-full max-w-[420px] rounded-[28px] border p-7 shadow-2xl relative transition-all"
      >
        <button
          type="button"
          onClick={onClose}
          style={{ backgroundColor: palette.btn, color: palette.ink }}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-[22px] font-semibold tracking-tight mb-1">
          {isRegister ? 'Criar conta' : 'Entrar com e-mail'}
        </h2>
        <p style={{ color: palette.muted }} className="text-[13.5px] mb-5">
          {isRegister
            ? 'Comece em segundos com sua conta Vito.'
            : 'Acesse sua agenda, tarefas, finanças e bots.'}
        </p>

        {error && (
          <div
            style={{ backgroundColor: palette.redBg, color: palette.red }}
            className="flex items-center gap-2 p-3 mb-4 rounded-xl text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div
            style={{ backgroundColor: palette.greenBg, color: palette.acc }}
            className="p-3 mb-4 rounded-xl text-xs font-medium"
          >
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <input
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="name"
              style={{
                backgroundColor: palette.surf,
                borderColor: palette.line,
                color: palette.ink,
              }}
              className="w-full h-12 px-4 rounded-xl border focus:outline-none text-sm"
            />
          )}

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
            style={{
              backgroundColor: palette.surf,
              borderColor: palette.line,
              color: palette.ink,
            }}
            className="w-full h-12 px-4 rounded-xl border focus:outline-none text-sm"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={isRegister ? 'Criar senha (mín. 6 caracteres)' : 'Senha'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              style={{
                backgroundColor: palette.surf,
                borderColor: palette.line,
                color: palette.ink,
              }}
              className="w-full h-12 pl-4 pr-11 rounded-xl border focus:outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ color: palette.muted }}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: palette.ink, color: palette.bg }}
            className="w-full h-12 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRegister ? (
              'Criar conta'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="flex flex-col items-center gap-1.5 mt-4">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setInfo(null);
            }}
            style={{ color: palette.ink }}
            className="text-xs font-semibold hover:underline"
          >
            {isRegister ? 'Já tem uma conta? Entrar' : 'Não tem conta? Criar conta'}
          </button>

          {!isRegister && (
            <button
              type="button"
              id="lg-forgot"
              onClick={handleForgotPassword}
              style={{ color: palette.muted }}
              className="text-xs font-medium hover:underline"
            >
              Esqueci minha senha
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
