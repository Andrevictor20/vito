import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DEMO_SCENES, DemoScene } from './demoScenes';
import { DemoActionCard } from './DemoActionCard';

interface DemoStageProps {
  currentIndex: number;
  onSceneChange: (nextIndex: number) => void;
}

export const DemoStage: React.FC<DemoStageProps> = ({ currentIndex, onSceneChange }) => {
  const currentScene: DemoScene = DEMO_SCENES[currentIndex] || DEMO_SCENES[0];
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [previousScene, setPreviousScene] = useState<DemoScene | null>(null);

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

            // Tempo de resposta (1000ms)
            const respondTimeout = setTimeout(() => {
              if (currentRunId !== runIdRef.current) return;
              setIsWaiting(false);
              setShowResponse(true);

              // Mantém cena visível por 3.8s antes de avançar automaticamente
              const advanceTimeout = setTimeout(() => {
                if (currentRunId !== runIdRef.current) return;
                setPreviousScene(currentScene);
                onSceneChange((currentIndex + 1) % DEMO_SCENES.length);
              }, 3800);

              return () => clearTimeout(advanceTimeout);
            }, 1000);

            return () => clearTimeout(respondTimeout);
          }, 450);

          return () => clearTimeout(waitTimeout);
        }
      }, 36);

      return () => clearInterval(typeInterval);
    }, 300);

    return () => clearTimeout(startTypingTimeout);
  }, [currentIndex, currentScene, onSceneChange]);

  const handleManualAdvance = useCallback(() => {
    setPreviousScene(currentScene);
    onSceneChange((currentIndex + 1) % DEMO_SCENES.length);
  }, [currentIndex, currentScene, onSceneChange]);

  return (
    <div
      onClick={handleManualAdvance}
      title="Toque para ver o próximo exemplo"
      className="relative w-full h-[480px] rounded-[28px] bg-white/70 dark:bg-[#0d0f10]/80 backdrop-blur-md border border-[#d2d7d4] dark:border-[#2c3134] p-6 lg:p-8 flex flex-col justify-end overflow-hidden cursor-pointer shadow-vito-card transition-all duration-300 hover:border-zinc-400 dark:hover:border-zinc-600 group select-none"
    >
      {/* Máscara de degradê no topo para as mensagens que sobem sumirem com elegância */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 22%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 22%)',
        }}
      />

      {/* Indicador de progresso de cenas */}
      <div className="absolute top-5 right-6 flex items-center gap-1.5 z-20">
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

      <div className="w-full flex flex-col gap-4 z-10">
        {/* Troca Anterior (Empurrada para cima com fade) */}
        {previousScene && (
          <div className="flex flex-col gap-2 opacity-30 blur-[0.4px] transition-all duration-500 transform -translate-y-2">
            <div className="self-end max-w-[85%] px-3.5 py-2.5 rounded-[20px] rounded-br-[4px] bg-[#17191b] dark:bg-[#f1f3f2] text-white dark:text-[#0d0f10] text-sm leading-snug">
              {previousScene.userText}
            </div>
            <div className="text-sm text-[#69706d] dark:text-[#98a19d] leading-relaxed">
              {previousScene.vitoText}
            </div>
          </div>
        )}

        {/* Troca Ativa Atual */}
        <div className="flex flex-col gap-3 transition-opacity duration-300">
          {/* Bolha do Usuário */}
          <div className="self-end max-w-[85%] flex flex-col items-end">
            {currentScene.photo && (
              <div className="w-24 h-14 rounded-lg mb-2 p-2 relative bg-gradient-to-b from-[#f6f1e4] to-[#efe7d2] shadow-sm">
                <div className="w-11 h-1 rounded-sm bg-[#b9ae93] mb-1.5" />
                <div className="w-16 h-1 rounded-sm bg-[#b9ae93] mb-1.5" />
                <div className="w-12 h-1 rounded-sm bg-[#b9ae93]" />
              </div>
            )}

            <div
              className={`px-3.5 py-2.5 rounded-[20px] rounded-br-[4px] bg-[#17191b] dark:bg-[#f1f3f2] text-white dark:text-[#0d0f10] text-sm leading-snug shadow-sm ${
                isTyping ? 'caret-cursor' : ''
              }`}
            >
              {typedText || <span className="opacity-0">...</span>}
            </div>
          </div>

          {/* Resposta do Vito */}
          <div className="relative min-h-[32px] text-sm font-medium text-[#17191b] dark:text-[#f1f3f2] leading-relaxed">
            {/* Pontos de espera / digitação do Vito */}
            {isWaiting && (
              <div className="flex items-center gap-1.5 py-1">
                <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-dot" />
                <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-dot [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-dot [animation-delay:0.3s]" />
              </div>
            )}

            {/* Conteúdo final da resposta + card temático */}
            {showResponse && (
              <div className="animate-rise">
                <p className="font-medium">{currentScene.vitoText}</p>
                <DemoActionCard card={currentScene.card} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dica discreta de clique */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 text-[11px] text-zinc-400 dark:text-zinc-500 opacity-50 group-hover:opacity-100 transition-opacity">
        Clique para avançar o exemplo
      </div>
    </div>
  );
};
