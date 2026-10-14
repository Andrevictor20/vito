import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';

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

// Implementação web (react-native-pager-view não funciona no web: codegen nativo).
export const AdaptivePager = forwardRef<AdaptivePagerRef, AdaptivePagerProps>(({
  initialPage = 0,
  scrollEnabled = true,
  onPageSelected,
  children,
  style,
}, ref) => {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const currentRef = useRef(initialPage);
  const count = React.Children.count(children);

  useImperativeHandle(ref, () => ({
    setPage: (index: number) => {
      currentRef.current = index;
      if (width > 0) scrollRef.current?.scrollTo({ x: index * width, animated: true });
    },
    setPageWithoutAnimation: (index: number) => {
      currentRef.current = index;
      if (width > 0) scrollRef.current?.scrollTo({ x: index * width, animated: false });
    },
  }));

  return (
    <View
      style={style}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== width) {
          setWidth(w);
          if (currentRef.current > 0) {
            requestAnimationFrame(() => {
              scrollRef.current?.scrollTo({ x: currentRef.current * w, animated: false });
            });
          }
        }
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentOffset={width > 0 ? { x: initialPage * width, y: 0 } : undefined}
        onMomentumScrollEnd={(e) => {
          if (width <= 0) return;
          const index = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / width), count - 1));
          if (index !== currentRef.current) {
            currentRef.current = index;
            onPageSelected?.(index);
          }
        }}
        style={styles.fill}
      >
        {children}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
