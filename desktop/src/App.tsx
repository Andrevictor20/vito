import React from 'react';
import { useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { DesktopLayout } from './components/layout/DesktopLayout';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0D10] text-slate-400 gap-3 select-none">
        <div className="w-12 h-12 rounded-2xl bg-[#1C2026] border border-white/10 flex items-center justify-center text-xl shadow-glow-primary animate-pulse">
          🎩
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <Loader2 size={14} className="animate-spin text-indigo-400" />
          <span>Iniciando Vito Desktop...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return <DesktopLayout />;
};
