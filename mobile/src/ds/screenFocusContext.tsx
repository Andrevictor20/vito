import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface ScreenFocusState {
  active: boolean;
  enterCount: number;
}

const ScreenFocusContext = createContext<ScreenFocusState>({
  active: true,
  enterCount: 1,
});

export const ScreenFocusProvider: React.FC<{
  active: boolean;
  children: React.ReactNode;
}> = ({ active, children }) => {
  const [enterCount, setEnterCount] = useState<number>(active ? 1 : 0);
  const prevActiveRef = useRef<boolean>(active);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;
    if (active && !wasActive) {
      setEnterCount((c) => c + 1);
    }
  }, [active]);

  const value = useMemo<ScreenFocusState>(
    () => ({ active, enterCount }),
    [active, enterCount]
  );

  return (
    <ScreenFocusContext.Provider value={value}>
      {children}
    </ScreenFocusContext.Provider>
  );
};

export function useScreenFocus(): ScreenFocusState {
  return useContext(ScreenFocusContext);
}

export function useScreenEnterKey(): number {
  return useContext(ScreenFocusContext).enterCount;
}
