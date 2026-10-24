import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DEMO_SCENES, DemoScene } from './demoScenes';
import { DemoActionCard } from './DemoActionCard';

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
  const currentScene: DemoScene = DEMO_SCENES[currentIndex] || DEMO_SCENES[0];
  const prevScene: DemoScene = getWrappedScene(currentIndex - 1);
  const olderScene: DemoScene = getWrappedScene(currentIndex - 2);

  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  const runIdRef = useRef(0);

  useEffect(() => {
    const currentRunId = ++runIdRef.current;

    setIsTyping(false);
    setIsWaiting(false);
    setShowResponse(false);
    setTypedText('');

    let charIndex = 0;
    const fullText = currentScene.userText;

    const startTypingTimeout = setTimeout(() => {
      if (currentRunId !== runIdRef.current) return;
      setIsTyping(true);

      const typeInterval = setInterval(() => {
        if (currentRunId !== runIdRef.current) {
          clearInterval(typeInterval);
          return;
        }

        charIndex++;
        setTypedText(fullText.slice(0, charIndex));

        if (charIndex >= fullText.length) {
          clearInterval(typeInterval);
          setIsTyping(false);

          // Pausa antes das reticências do assistente
          const waitTimeout = setTimeout(() => {
            if (currentRunId !== runIdRef.current) return;
            setIsWaiting(true);

            // Tempo de resposta do assistente (850ms)
            const respondTimeout = setTimeout(() => {
              if (currentRunId !== runIdRef.current) return;
              setIsWaiting(false);
              setShowResponse(true);

              // Mantém cena visível por 3.8s antes de avançar automaticamente
              const advanceTimeout = setTimeout(() => {
                if (currentRunId !== runIdRef.current) return;
                onSceneChange((currentIndex + 1) % DEMO_SCENES.length);
              }, 3800);

              return () => clearTimeout(advanceTimeout);
            }, 850);

            return () => clearTimeout(respondTimeout);
          }, 350);

          return () => clearTimeout(waitTimeout);
        }
      }, 34);

      return () => clearInterval(typeInterval);
    }, 250);

    return () => clearTimeout(startTypingTimeout);
  }, [currentIndex, currentScene, onSceneChange]);

  const handleManualAdvance = useCallback(() => {
    onSceneChange((currentIndex + 1) % DEMO_SCENES.length);
  }, [currentIndex, onSceneChange]);

  return (
    <div
      onClick={handleManualAdvance}
      title="Clique para ver o próximo exemplo"
      className="relative w-full h-[540px] rounded-[32px] bg-white dark:bg-[#0d0f10] border border-[#d2d7d4] dark:border-[#2c3134] p-6 lg:p-8 flex flex-col justify-end overflow-hidden cursor-pointer shadow-[0_12px_40px_rgba(20,25,22,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-zinc-400 dark:hover:border-zinc-600 group select-none"
    >
      {/* Degradê superior suave fazendo as mensagens que sobem sumirem */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none z-20 bg-gradient-to-b from-white via-white/80 to-transparent dark:from-[#0d0f10] dark:via-[#0d0f10]/80 dark:to-transparent"
      />

      {/* Indicador de progresso das 6 cenas temáticas */}
      <div className="absolute top-6 right-6 flex items-center gap-1.5 z-30">
        {DEMO_SCENES.map((s, idx) => (
          <span
            key={s.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? 'w-6 bg-[#00E599]'
                : 'w-1.5 bg-zinc-300 dark:bg-zinc-700 opacity-60'
            }`}
          />
        ))}
      </div>

      {/* Pilha de Conversas Ancorada na Base */}
      <div className="w-full flex flex-col justify-end gap-5 z-10">
        {/* Troca Mais Antiga (olderScene) - Topo da Pilha */}
        <div className="flex flex-col gap-2.5 opacity-35 blur-[0.3px] transition-all duration-500 scale-[0.98] origin-bottom">
          <div className="self-end max-w-[85%] px-4 py-2.5 rounded-[20px] rounded-br-[4px] bg-[#17191b] dark:bg-[#f1f3f2] text-white dark:text-[#0d0f10] text-sm leading-snug">
            {olderScene.userText}
          </div>
          <div className="text-sm text-[#17191b] dark:text-[#f1f3f2] font-medium leading-relaxed">
            <p>{olderScene.vitoText}</p>
            <DemoActionCard card={olderScene.card} />
          </div>
        </div>

        {/* Troca Intermediária (prevScene) */}
        <div className="flex flex-col gap-2.5 opacity-70 transition-all duration-500 scale-[0.99] origin-bottom">
          <div className="self-end max-w-[85%] px-4 py-2.5 rounded-[20px] rounded-br-[4px] bg-[#17191b] dark:bg-[#f1f3f2] text-white dark:text-[#0d0f10] text-sm leading-snug shadow-xs">
            {prevScene.userText}
          </div>
          <div className="text-sm text-[#17191b] dark:text-[#f1f3f2] font-medium leading-relaxed">
            <p>{prevScene.vitoText}</p>
            <DemoActionCard card={prevScene.card} />
          </div>
        </div>

        {/* Troca Ativa em Digitação e Resposta Atual */}
        <div className="flex flex-col gap-3 transition-opacity duration-300">
          {/* Balão do Usuário Ativo */}
          <div className="self-end max-w-[85%] flex flex-col items-end">
            {currentScene.photo && (
              <div className="w-24 h-14 rounded-lg mb-2 p-2 relative bg-gradient-to-b from-[#f6f1e4] to-[#efe7d2] shadow-sm border border-[#e2d8c3]">
                <div className="w-11 h-1 rounded-sm bg-[#b9ae93] mb-1.5" />
                <div className="w-16 h-1 rounded-sm bg-[#b9ae93] mb-1.5" />
                <div className="w-12 h-1 rounded-sm bg-[#b9ae93]" />
              </div>
            )}

            <div
              className={`px-4 py-2.5 rounded-[20px] rounded-br-[4px] bg-[#17191b] dark:bg-[#f1f3f2] text-white dark:text-[#0d0f10] text-sm leading-snug shadow-sm ${
                isTyping ? 'caret-cursor' : ''
              }`}
            >
              {typedText || <span className="opacity-0">...</span>}
            </div>
          </div>

          {/* Resposta do Vito com Reticências e Action Card com Cores Vivas */}
          <div className="relative min-h-[36px] text-sm font-medium text-[#17191b] dark:text-[#f1f3f2] leading-relaxed">
            {isWaiting && (
              <div className="flex items-center gap-1.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-dot" />
                <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-dot [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-dot [animation-delay:0.3s]" />
              </div>
            )}

            {showResponse && (
              <div className="animate-rise space-y-2">
                <p className="font-medium text-[#17191b] dark:text-[#f1f3f2]">{currentScene.vitoText}</p>
                <DemoActionCard card={currentScene.card} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dica de Toque */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100 transition-opacity">
        Clique para ver o próximo exemplo
      </div>
    </div>
  );
};
