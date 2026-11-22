import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DEMO_SCENES, DemoScene } from './demoScenes';
import { DemoActionCard } from './DemoActionCard';
import { useTheme } from '../../context/ThemeContext';
import { loginPalette } from './loginPalette';

interface DemoStageProps {
  currentIndex: number;
  onSceneChange: (nextIndex: number) => void;
}

function getWrappedScene(index: number): DemoScene {
  const total = DEMO_SCENES.length;
  const normalized = ((index % total) + total) % total;
  return DEMO_SCENES[normalized];
}

export const DemoStage: React.FC<DemoStageProps> = ({ currentIndex, onSceneChange }) => {
  const { isDark } = useTheme();
  const palette = loginPalette(isDark);
  const currentScene: DemoScene = DEMO_SCENES[currentIndex] || DEMO_SCENES[0];
  const prevScene: DemoScene = getWrappedScene(currentIndex - 1);

  const reduceMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const [typedText, setTypedText] = useState(reduceMotion ? currentScene.userText : '');
  const [isTyping, setIsTyping] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showResponse, setShowResponse] = useState(reduceMotion);

  const runIdRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      setTypedText(currentScene.userText);
      setIsTyping(false);
      setIsWaiting(false);
      setShowResponse(true);
      return;
    }

    const currentRunId = ++runIdRef.current;
    setIsTyping(false);
    setIsWaiting(false);
    setShowResponse(false);
    setTypedText('');

    let charIndex = 0;
    const fullText = currentScene.userText;
    let typeInterval: ReturnType<typeof setInterval> | undefined;
    let waitTimeout: ReturnType<typeof setTimeout> | undefined;
    let respondTimeout: ReturnType<typeof setTimeout> | undefined;
    let advanceTimeout: ReturnType<typeof setTimeout> | undefined;

    const startTypingTimeout = setTimeout(() => {
      if (currentRunId !== runIdRef.current) return;
      setIsTyping(true);

      typeInterval = setInterval(() => {
        if (currentRunId !== runIdRef.current) {
          if (typeInterval) clearInterval(typeInterval);
          return;
        }

        charIndex++;
        setTypedText(fullText.slice(0, charIndex));

        if (charIndex >= fullText.length) {
          if (typeInterval) clearInterval(typeInterval);
          setIsTyping(false);

          waitTimeout = setTimeout(() => {
            if (currentRunId !== runIdRef.current) return;
            setIsWaiting(true);

            respondTimeout = setTimeout(() => {
              if (currentRunId !== runIdRef.current) return;
              setIsWaiting(false);
              setShowResponse(true);

              advanceTimeout = setTimeout(() => {
                if (currentRunId !== runIdRef.current) return;
                onSceneChange((currentIndex + 1) % DEMO_SCENES.length);
              }, 3200);
            }, 750);
          }, 320);
        }
      }, 28);
    }, 220);

    return () => {
      clearTimeout(startTypingTimeout);
      if (typeInterval) clearInterval(typeInterval);
      if (waitTimeout) clearTimeout(waitTimeout);
      if (respondTimeout) clearTimeout(respondTimeout);
      if (advanceTimeout) clearTimeout(advanceTimeout);
    };
  }, [currentIndex, currentScene, onSceneChange, reduceMotion]);

  const handleManualAdvance = useCallback(() => {
    onSceneChange((currentIndex + 1) % DEMO_SCENES.length);
  }, [currentIndex, onSceneChange]);

  return (
    <div className="flex flex-col w-full">
      <div
        id="lg-stage"
        role="button"
        tabIndex={0}
        onClick={handleManualAdvance}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleManualAdvance();
          }
        }}
        aria-label="Demonstração interativa: toque para ver o próximo exemplo"
        style={{
          backgroundColor: palette.bg,
          borderColor: palette.hairline,
        }}
        className="relative w-full h-[460px] rounded-[28px] border p-6 lg:p-7 flex flex-col justify-end overflow-hidden cursor-pointer shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-all duration-300 select-none"
      >
        <div
          style={{
            background: `linear-gradient(to bottom, ${palette.bg} 0%, transparent 100%)`,
          }}
          className="absolute top-0 left-0 right-0 h-24 pointer-events-none z-20"
        />

        <div className="w-full flex flex-col justify-end gap-5 z-10">
          <div className="flex flex-col gap-2.5 opacity-40 scale-[0.97] origin-bottom transition-all duration-500">
            <div
              style={{ backgroundColor: palette.ink, color: palette.bg }}
              className="self-end max-w-[86%] px-4 py-2.5 rounded-[20px] rounded-br-[6px] text-sm font-medium leading-snug"
            >
              {prevScene.userText}
            </div>
            <div style={{ color: palette.ink }} className="text-sm leading-relaxed">
              <p>{prevScene.vitoText}</p>
              <DemoActionCard card={prevScene.card} />
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div
              style={{ backgroundColor: palette.ink, color: palette.bg }}
              className={`self-end max-w-[86%] px-4 py-2.5 rounded-[20px] rounded-br-[6px] text-sm font-medium leading-snug shadow-sm ${
                isTyping ? 'caret-cursor' : ''
              }`}
            >
              {typedText || <span className="opacity-0">...</span>}
            </div>

            <div style={{ color: palette.ink }} className="relative min-h-[36px] text-sm leading-relaxed">
              {isWaiting && (
                <div className="flex items-center gap-1.5 py-1.5">
                  <span style={{ backgroundColor: palette.muted }} className="w-2 h-2 rounded-full animate-dot" />
                  <span style={{ backgroundColor: palette.muted }} className="w-2 h-2 rounded-full animate-dot [animation-delay:0.15s]" />
                  <span style={{ backgroundColor: palette.muted }} className="w-2 h-2 rounded-full animate-dot [animation-delay:0.3s]" />
                </div>
              )}

              {showResponse && (
                <div className="animate-rise space-y-2">
                  <p>{currentScene.vitoText}</p>
                  <DemoActionCard card={currentScene.card} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div id="lg-dots" className="flex items-center justify-center gap-1.5 mt-3">
        {DEMO_SCENES.map((s, idx) => (
          <span
            key={s.id}
            style={{
              width: idx === currentIndex ? 18 : 6,
              backgroundColor: idx === currentIndex ? palette.ink : palette.line,
            }}
            className="h-1.5 rounded-[3px] transition-all duration-300"
          />
        ))}
      </div>
    </div>
  );
};
