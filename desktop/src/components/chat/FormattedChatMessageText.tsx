import React from 'react';

interface FormattedChatMessageTextProps {
  text: string;
  isUser: boolean;
  className?: string;
}

export const FormattedChatMessageText: React.FC<FormattedChatMessageTextProps> = ({
  text,
  isUser,
  className = '',
}) => {
  if (!text) return null;

  if (isUser) {
    return <span className={className}>{text}</span>;
  }

  // Divide o texto em blocos de parágrafos/linhas
  const lines = text.split('\n');
  let insideCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  const renderedElements: React.ReactNode[] = [];

  const renderInlineFormatted = (raw: string, keyPrefix: string) => {
    if (!raw) return null;

    // Captura negrito **bold** e código inline `code`
    const tokenRegex = /(\*\*[^*]+?\*\*|`[^`]+?`)/g;
    const parts = raw.split(tokenRegex);

    return parts.map((part, idx) => {
      const partKey = `${keyPrefix}-${idx}`;
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        const boldText = part.slice(2, -2);
        return (
          <strong key={partKey} className="font-bold text-zinc-900 dark:text-white">
            {boldText}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        const codeText = part.slice(1, -1);
        return (
          <code
            key={partKey}
            className="px-1.5 py-0.5 rounded-md bg-zinc-200/60 dark:bg-white/10 font-mono text-xs sm:text-sm text-zinc-800 dark:text-zinc-200"
          >
            {codeText}
          </code>
        );
      }
      // Remove asteriscos soltos indesejados
      const sanitizedPart = part.replace(/\*/g, '');
      return <span key={partKey}>{sanitizedPart}</span>;
    });
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Tratamento de bloco de código ```
    if (trimmed.startsWith('```')) {
      if (insideCodeBlock) {
        const codeContent = codeBlockBuffer.join('\n');
        renderedElements.push(
          <div
            key={`code-block-${lineIdx}`}
            className="my-3 p-3.5 rounded-xl bg-zinc-100 dark:bg-[#12151A] border border-zinc-200 dark:border-[#222730] font-mono text-xs sm:text-sm overflow-x-auto text-zinc-900 dark:text-zinc-200"
          >
            <pre className="whitespace-pre-wrap">{codeContent}</pre>
          </div>
        );
        codeBlockBuffer = [];
        insideCodeBlock = false;
      } else {
        insideCodeBlock = true;
      }
      return;
    }

    if (insideCodeBlock) {
      codeBlockBuffer.push(line);
      return;
    }

    // Linha vazia vira espaçamento entre parágrafos
    if (!trimmed) {
      renderedElements.push(<div key={`spacer-${lineIdx}`} className="h-2.5" />);
      return;
    }

    // Bullet points (•, -, *)
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletContent = trimmed.slice(2);
      renderedElements.push(
        <div key={`bullet-${lineIdx}`} className="flex items-start gap-2.5 my-1 pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
          <span className="flex-1 leading-relaxed">
            {renderInlineFormatted(bulletContent, `b-${lineIdx}`)}
          </span>
        </div>
      );
      return;
    }

    // Listas numeradas (1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const itemContent = numberedMatch[2];
      renderedElements.push(
        <div key={`num-${lineIdx}`} className="flex items-start gap-2 my-1 pl-1">
          <span className="font-mono text-xs font-bold text-zinc-400 shrink-0 mt-0.5">
            {num}.
          </span>
          <span className="flex-1 leading-relaxed">
            {renderInlineFormatted(itemContent, `n-${lineIdx}`)}
          </span>
        </div>
      );
      return;
    }

    // Parágrafo regular
    renderedElements.push(
      <p key={`p-${lineIdx}`} className="leading-relaxed">
        {renderInlineFormatted(line, `l-${lineIdx}`)}
      </p>
    );
  });

  return (
    <div className={`space-y-1 text-sm sm:text-base text-zinc-800 dark:text-zinc-200 ${className}`}>
      {renderedElements}
    </div>
  );
};
