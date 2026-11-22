import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { SplashScreen } from './components/auth/SplashScreen';
import {
  PostLoginPermissionsModal,
  hasPromptedDesktopPerms,
} from './components/auth/PostLoginPermissionsModal';
import { DesktopLayout } from './components/layout/DesktopLayout';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = user?.id ?? null;
    const prevId = prevUserIdRef.current;
    prevUserIdRef.current = currentId;

    if (!currentId) {
      setShowPerms(false);
      return;
    }

    if (!loading && prevId === null && !hasPromptedDesktopPerms()) {
      const t = setTimeout(() => setShowPerms(true), 650);
      return () => clearTimeout(t);
    }
  }, [user?.id, loading]);

  return (
    <>
      {!loading && (!user ? <AuthView /> : <DesktopLayout />)}
      {user && (
        <PostLoginPermissionsModal
          isOpen={showPerms}
          onClose={() => setShowPerms(false)}
        />
      )}
      {(loading || !splashDone) && (
        <SplashScreen
          autoDismiss
          durationMs={1900}
          onFinish={() => setSplashDone(true)}
        />
      )}
    </>
  );
};
