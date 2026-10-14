import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import PagerView from 'react-native-pager-view';

export interface AdaptivePagerRef {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
}

interface AdaptivePagerProps {
  initialPage?: number;
  scrollEnabled?: boolean;
  onPageSelected?: (position: number) => void;
  children: React.ReactNode[];
  style?: any;
}

// Implementação nativa (PagerView real). No web, o Metro usa AdaptivePager.web.tsx.
export const AdaptivePager = forwardRef<AdaptivePagerRef, AdaptivePagerProps>(({
  initialPage = 0,
  scrollEnabled = true,
  onPageSelected,
  children,
  style,
}, ref) => {
  const pagerRef = useRef<PagerView>(null);
  useImperativeHandle(ref, () => ({
    setPage: (index: number) => pagerRef.current?.setPage(index),
    setPageWithoutAnimation: (index: number) => pagerRef.current?.setPageWithoutAnimation(index),
  }));
  return (
    <PagerView
      ref={pagerRef}
      style={style}
      initialPage={initialPage}
      scrollEnabled={scrollEnabled}
      onPageSelected={(e) => onPageSelected?.(e.nativeEvent.position)}
    >
      {children}
    </PagerView>
  );
});
