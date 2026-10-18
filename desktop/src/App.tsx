import React from 'react';
import { useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { DesktopLayout } from './components/layout/DesktopLayout';
import { VitoMascot } from './components/common/VitoMascot';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0D10] text-zinc-400 gap-3 select-none">
        <VitoMascot size={44} className="animate-pulse" />
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          <Loader2 size={14} className="animate-spin text-white" />
          <span>Iniciando Vito...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return <DesktopLayout />;
};
