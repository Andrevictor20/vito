import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  AudioWaveform,
  Camera,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Mic,
  Plus,
  Square,
  X,
} from 'lucide-react';
import type { FocusMode } from './FocusMenu';

interface ChatInputDockProps {
  onSendMessage: (text: string, focus: FocusMode | null) => void;
  loading: boolean;
  onStop?: () => void;
  onPressVoice?: () => void;
  modelName?: string;
  modelColor?: string;
  onOpenModelPicker?: () => void;
}

export const ChatInputDock: React.FC<ChatInputDockProps> = ({
  onSendMessage,
  loading,
  onStop,
  onPressVoice,
  modelName = 'Vito Auto',
  modelColor = 'var(--ink)',
  onOpenModelPicker,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasTextOrAttachment = inputValue.trim().length > 0 || !!attachedFileName;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setAttachOpen(false);
      }
    };
    if (attachOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [attachOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    const text = inputValue.trim();
    const payload = attachedFileName
      ? `${text ? `${text}\n` : ''}[Anexo: ${attachedFileName}]`
      : text;
    if (!payload) return;
    onSendMessage(payload, null);
    setInputValue('');
    setAttachedFileName(null);
  };

  const openFilePicker = (accept: string, capture?: string) => {
    setAttachOpen(false);
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = accept;
    if (capture) {
      input.setAttribute('capture', capture);
    } else {
      input.removeAttribute('capture');
    }
    input.click();
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setAttachedFileName(file.name);
          }
          e.target.value = '';
        }}
      />

      {attachedFileName && (
        <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surf)] border border-[var(--line)] text-xs font-medium text-[var(--ink)]">
          <FileText size={13} className="text-[var(--muted)]" />
          <span className="max-w-[220px] truncate">{attachedFileName}</span>
          <button
            type="button"
            onClick={() => setAttachedFileName(null)}
            className="text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Remover anexo"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Composer limpo de 2 linhas (.cmp) */}
      <div className="rounded-[28px] bg-[var(--surf)] border border-[var(--hairline,var(--line))] px-3.5 py-2.5 shadow-[var(--shadow)] transition-all">
        {/* Linha 1: + Anexos e seletor de modelo #c-model */}
        <div className="flex items-center gap-2 pb-1.5" ref={attachRef}>
          <div className="relative">
            <button
              id="c-attach"
              type="button"
              onClick={() => setAttachOpen((prev) => !prev)}
              className="v5-press w-9 h-9 rounded-full bg-[var(--btn)] text-[var(--ink)] flex items-center justify-center hover:opacity-90"
              title="Anexar arquivo ou imagem"
              aria-label="Anexar arquivo ou imagem"
            >
              <Plus size={17} />
            </button>

            {attachOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-72 rounded-[22px] bg-[var(--bg)] border border-[var(--line)] shadow-[var(--shadow)] p-2 z-50 tr-tab">
                <div className="px-3 py-1.5">
                  <p className="text-xs font-medium text-[var(--ink)]">Anexar ao chat</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    O Vito lê imagens e PDFs automaticamente
                  </p>
                </div>
                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => openFilePicker('image/*', 'environment')}
                    className="v5-press w-full flex items-center gap-3 p-2.5 rounded-2xl text-left hover:bg-[var(--surf)]"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[var(--surf)] flex items-center justify-center text-[var(--ink)]">
                      <Camera size={16} />
                    </span>
                    <span className="min-w-0">
                      <b className="block text-xs font-medium text-[var(--ink)]">Tirar foto</b>
                      <small className="block text-[11px] text-[var(--muted)]">
                        Ler boleto, convite ou anotação
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFilePicker('image/*')}
                    className="v5-press w-full flex items-center gap-3 p-2.5 rounded-2xl text-left hover:bg-[var(--surf)]"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[var(--surf)] flex items-center justify-center text-[var(--ink)]">
                      <ImageIcon size={16} />
                    </span>
                    <span className="min-w-0">
                      <b className="block text-xs font-medium text-[var(--ink)]">Galeria de fotos</b>
                      <small className="block text-[11px] text-[var(--muted)]">
                        Enviar print ou comprovante
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFilePicker('application/pdf,.pdf,.txt,.csv,.doc,.docx')}
                    className="v5-press w-full flex items-center gap-3 p-2.5 rounded-2xl text-left hover:bg-[var(--surf)]"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[var(--surf)] flex items-center justify-center text-[var(--ink)]">
                      <FileText size={16} />
                    </span>
                    <span className="min-w-0">
                      <b className="block text-xs font-medium text-[var(--ink)]">Arquivo ou PDF</b>
                      <small className="block text-[11px] text-[var(--muted)]">
                        Faturas, contratos e documentos
                      </small>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            id="c-model"
            type="button"
            onClick={onOpenModelPicker}
            aria-label="Modelo de IA"
            className="v5-press inline-flex items-center gap-1.5 h-9 px-3 rounded-[14px] bg-[var(--btn)] text-xs font-medium text-[var(--ink)] hover:opacity-90"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: modelColor }}
            />
            <span className="max-w-[180px] truncate">{modelName}</span>
            <ChevronDown size={12} className="text-[var(--muted)] shrink-0" />
          </button>
        </div>

        {/* Linha 2: Input + #c-mic + slot dinâmico .wv <-> .send */}
        <div className="flex items-end gap-2">
          <textarea
            id="c-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={1}
            placeholder={
              isRecording ? 'Gravando áudio... toque para parar' : 'Pergunte ao Vito...'
            }
            disabled={loading}
            className="flex-1 bg-transparent border-none text-[15px] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none resize-none px-1.5 py-2 leading-snug max-h-32"
          />

          <div className="flex items-center gap-2 pb-0.5 shrink-0">
            <button
              id="c-mic"
              type="button"
              onClick={() => setIsRecording((prev) => !prev)}
              className={`v5-press w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                isRecording
                  ? 'bg-[var(--red)] text-white animate-pulse'
                  : 'bg-[var(--btn)] text-[var(--ink)] hover:opacity-90'
              }`}
              title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
              aria-label={isRecording ? 'Parar gravação' : 'Gravar áudio'}
            >
              <Mic size={17} />
            </button>

            {loading ? (
              <button
                type="button"
                onClick={onStop}
                className="v5-press w-9 h-9 rounded-full bg-[var(--red)] text-white flex items-center justify-center"
                title="Interromper geração"
                aria-label="Interromper geração"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : hasTextOrAttachment ? (
              <button
                id="c-send"
                type="button"
                onClick={() => handleSubmit()}
                className="v5-press vito-pop-in w-9 h-9 rounded-full bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center"
                title="Enviar mensagem (Enter)"
                aria-label="Enviar"
              >
                <ArrowUp size={17} />
              </button>
            ) : (
              <button
                id="c-voice"
                type="button"
                onClick={onPressVoice}
                className="v5-press w-9 h-9 rounded-full bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center"
                title="Conversar por voz"
                aria-label="Conversar por voz"
              >
                <AudioWaveform size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
