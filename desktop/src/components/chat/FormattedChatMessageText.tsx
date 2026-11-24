import React from 'react';

interface FormattedChatMessageTextProps {
  text: string;
  isUser: boolean;
  className?: string;
}

export const isTableSeparatorRow = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const stripped = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = stripped.split('|');
  return cells.length >= 2 && cells.every((c) => /^\s*:?-{2,}:?\s*$/.test(c));
};

export const parseMarkdownTableRow = (line: string): string[] => {
  const trimmed = line.trim();
  const placeholder = '\u0000PIPE\u0000';
  const protectedEscapes = trimmed.replace(/\\\|/g, placeholder);
  const withoutEdges = protectedEscapes.replace(/^\|/, '').replace(/\|$/, '');
  return withoutEdges.split('|').map((cell) => cell.replace(new RegExp(placeholder, 'g'), '|').trim());
};

const isTableRowCandidate = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length >= 3;
};

export const FormattedChatMessageText: React.FC<FormattedChatMessageTextProps> = ({
  text,
  isUser,
  className = '',
}) => {
  if (!text) return null;

  if (isUser) {
    return <span className={className}>{text}</span>;
  }

  const lines = text.split('\n');
  let insideCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  const renderedElements: React.ReactNode[] = [];

  const renderInlineFormatted = (raw: string, keyPrefix: string) => {
    if (!raw) return null;

    const unescaped = raw.replace(/\\\|/g, '|');
    const tokenRegex = /(\*\*[^*]+?\*\*|`[^`]+?`|\[[^\]]+?\]\([^)]+?\)|\*[^*\n]+?\*)/g;
    const parts = unescaped.split(tokenRegex);

    return parts.map((part, idx) => {
      const partKey = `${keyPrefix}-${idx}`;
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={partKey} className="font-bold text-zinc-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={partKey}
            className="px-1.5 py-0.5 rounded-md bg-zinc-200/60 dark:bg-white/10 font-mono text-xs sm:text-sm text-zinc-800 dark:text-zinc-200"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        if (/^https?:\/\//i.test(url)) {
          return (
            <a
              key={partKey}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:opacity-80"
            >
              {label}
            </a>
          );
        }
        return <span key={partKey}>{label}</span>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
        return (
          <em key={partKey} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      const sanitizedPart = part.replace(/\*/g, '');
      return <span key={partKey}>{sanitizedPart}</span>;
    });
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();

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
      continue;
    }

    if (insideCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    if (
      isTableRowCandidate(trimmed) &&
      lineIdx + 1 < lines.length &&
      isTableSeparatorRow(lines[lineIdx + 1])
    ) {
      const headers = parseMarkdownTableRow(trimmed);
      const rows: string[][] = [];
      let cursor = lineIdx + 2;
      while (cursor < lines.length && isTableRowCandidate(lines[cursor])) {
        rows.push(parseMarkdownTableRow(lines[cursor]));
        cursor++;
      }
      lineIdx = cursor - 1;

      renderedElements.push(
        <div
          key={`table-${lineIdx}`}
          className="my-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800"
        >
          <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-zinc-100/80 dark:bg-white/5 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                {headers.map((header, cIdx) => (
                  <th
                    key={`th-${cIdx}`}
                    className="px-3 py-2 font-semibold text-zinc-900 dark:text-white whitespace-nowrap"
                  >
                    {renderInlineFormatted(header, `th-${lineIdx}-${cIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 tabular-nums">
              {rows.map((row, rIdx) => (
                <tr
                  key={`tr-${rIdx}`}
                  className={rIdx % 2 === 1 ? 'bg-zinc-50/60 dark:bg-white/[0.02]' : undefined}
                >
                  {headers.map((_, cIdx) => (
                    <td key={`td-${rIdx}-${cIdx}`} className="px-3 py-2 align-top">
                      {renderInlineFormatted(row[cIdx] || '', `td-${lineIdx}-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (!trimmed) {
      renderedElements.push(<div key={`spacer-${lineIdx}`} className="h-2.5" />);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      renderedElements.push(
        <hr key={`hr-${lineIdx}`} className="my-3 border-zinc-200 dark:border-zinc-800" />
      );
      continue;
    }

    if (/^#{1,4}\s+/.test(trimmed)) {
      const headerClean = trimmed.replace(/^#{1,4}\s+/, '').trim();
      renderedElements.push(
        <h4 key={`h-${lineIdx}`} className="font-bold text-base sm:text-lg mt-3 mb-1 text-zinc-900 dark:text-white">
          {renderInlineFormatted(headerClean, `h-${lineIdx}`)}
        </h4>
      );
      continue;
    }

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
      continue;
    }

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
      continue;
    }

    renderedElements.push(
      <p key={`p-${lineIdx}`} className="leading-relaxed">
        {renderInlineFormatted(line, `l-${lineIdx}`)}
      </p>
    );
  }

  return (
    <div className={`space-y-1 text-sm sm:text-base text-zinc-800 dark:text-zinc-200 ${className}`}>
      {renderedElements}
    </div>
  );
};
