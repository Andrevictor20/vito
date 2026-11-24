import React from 'react';
import { StyleSheet, View, Text, ScrollView, Linking } from 'react-native';

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

const renderInlineFormatted = (raw: string, textColor: string, isDark: boolean) => {
  if (!raw) return null;

  const unescaped = raw.replace(/\\\|/g, '|');
  // Captura **bold**, `code`, [label](url) e *itálico*
  const tokenRegex = /(\*\*[^*]+?\*\*|`[^`]+?`|\[[^\]]+?\]\([^)]+?\)|\*[^*\n]+?\*)/g;
  const parts = unescaped.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <Text key={idx} style={{ fontWeight: '700', color: textColor }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Text
          key={idx}
          style={[
            styles.inlineCode,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
              color: textColor,
            },
          ]}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      return (
        <Text
          key={idx}
          style={[styles.inlineLink, { color: textColor }]}
          onPress={() => {
            if (/^https?:\/\//i.test(url)) {
              Linking.openURL(url).catch(() => {});
            }
          }}
        >
          {label}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
      return (
        <Text key={idx} style={{ fontStyle: 'italic', color: textColor }}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    const sanitizedPart = part.replace(/\*/g, '');
    return (
      <Text key={idx} style={{ color: textColor }}>
        {sanitizedPart}
      </Text>
    );
  });
};

export interface FormattedChatMessageTextProps {
  text: string;
  isUser: boolean;
  style?: any;
  textColor: string;
  isDark?: boolean;
}

export const FormattedChatMessageText: React.FC<FormattedChatMessageTextProps> = React.memo(({
  text,
  isUser,
  style,
  textColor,
  isDark = false,
}) => {
  const renderedElements = React.useMemo(() => {
    if (!text || isUser) return null;

    const lines = text.split('\n');
    let insideCodeBlock = false;
    let codeBlockBuffer: string[] = [];
    const elements: React.ReactNode[] = [];
    const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
    const headerBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const zebraBg = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)';

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        if (insideCodeBlock) {
          const codeContent = codeBlockBuffer.join('\n');
          elements.push(
            <View
              key={`code-block-${lineIdx}`}
              style={[
                styles.codeBlock,
                {
                  backgroundColor: isDark ? '#141618' : '#F4F5F4',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                },
              ]}
            >
              <Text style={[styles.codeBlockText, { color: textColor }]}>{codeContent}</Text>
            </View>
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

      // Tabela Markdown (cabeçalho + separador |---| + linhas)
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

        const colCount = headers.length;
        const colWidths = headers.map((h, colIdx) => {
          let maxLen = h.length;
          for (const r of rows) {
            const cellLen = (r[colIdx] || '').length;
            if (cellLen > maxLen) maxLen = cellLen;
          }
          return Math.min(220, Math.max(78, maxLen * 7.6 + 24));
        });

        elements.push(
          <ScrollView
            key={`table-${lineIdx}`}
            horizontal
            showsHorizontalScrollIndicator
            style={styles.tableScroll}
            contentContainerStyle={styles.tableScrollContent}
          >
            <View style={[styles.tableBox, { borderColor }]}>
              <View style={[styles.tableRow, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
                {headers.map((header, cIdx) => (
                  <View
                    key={`th-${cIdx}`}
                    style={[
                      styles.tableCell,
                      { width: colWidths[cIdx] },
                      cIdx < colCount - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: borderColor },
                    ]}
                  >
                    <Text style={[styles.tableHeaderText, { color: textColor }]}>
                      {renderInlineFormatted(header, textColor, isDark)}
                    </Text>
                  </View>
                ))}
              </View>
              {rows.map((row, rIdx) => (
                <View
                  key={`tr-${rIdx}`}
                  style={[
                    styles.tableRow,
                    rIdx % 2 === 1 && { backgroundColor: zebraBg },
                    rIdx === rows.length - 1 ? styles.tableRowLast : { borderBottomColor: borderColor },
                  ]}
                >
                  {headers.map((_, cIdx) => (
                    <View
                      key={`td-${rIdx}-${cIdx}`}
                      style={[
                        styles.tableCell,
                        { width: colWidths[cIdx] },
                        cIdx < colCount - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: borderColor },
                      ]}
                    >
                      <Text style={[styles.tableCellText, { color: textColor }]}>
                        {renderInlineFormatted(row[cIdx] || '', textColor, isDark)}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );
        continue;
      }

      if (!trimmed) {
        elements.push(<View key={`space-${lineIdx}`} style={styles.paragraphSpacer} />);
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        elements.push(<View key={`hr-${lineIdx}`} style={[styles.hrLine, { backgroundColor: borderColor }]} />);
        continue;
      }

      if (/^#{1,4}\s+/.test(trimmed)) {
        const headerClean = trimmed.replace(/^#{1,4}\s+/, '').trim();
        elements.push(
          <Text key={`header-${lineIdx}`} style={[style, styles.headerLine, { color: textColor }]}>
            {renderInlineFormatted(headerClean, textColor, isDark)}
          </Text>
        );
        continue;
      }

      if (/^[\*\-\+•]\s+/.test(trimmed)) {
        const bulletClean = trimmed.replace(/^[\*\-\+•]\s+/, '').trim();
        elements.push(
          <View key={`bullet-${lineIdx}`} style={styles.bulletRow}>
            <Text style={[styles.bulletSymbol, { color: textColor }]}>•</Text>
            <Text style={[style, styles.bulletContent, { color: textColor }]}>
              {renderInlineFormatted(bulletClean, textColor, isDark)}
            </Text>
          </View>
        );
        continue;
      }

      const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
      if (numberedMatch) {
        const [, number, content] = numberedMatch;
        elements.push(
          <View key={`num-${lineIdx}`} style={styles.bulletRow}>
            <Text style={[styles.numberedSymbol, { color: textColor }]}>{number}.</Text>
            <Text style={[style, styles.bulletContent, { color: textColor }]}>
              {renderInlineFormatted(content, textColor, isDark)}
            </Text>
          </View>
        );
        continue;
      }

      elements.push(
        <Text key={`normal-${lineIdx}`} style={[style, styles.normalLine, { color: textColor }]}>
          {renderInlineFormatted(line, textColor, isDark)}
        </Text>
      );
    }

    return elements;
  }, [text, isUser, textColor, isDark, style]);

  if (!text) return null;

  if (isUser) {
    return <Text style={[style, { color: textColor }]}>{text}</Text>;
  }

  return <View style={styles.formattedContainer}>{renderedElements}</View>;
});

const styles = StyleSheet.create({
  formattedContainer: {
    gap: 3,
    width: '100%',
  },
  paragraphSpacer: {
    height: 10,
  },
  hrLine: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    width: '100%',
  },
  headerLine: {
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 26,
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 2,
    marginVertical: 2,
  },
  bulletSymbol: {
    fontSize: 16,
    lineHeight: 25,
    marginRight: 8,
    fontWeight: '700',
  },
  numberedSymbol: {
    fontSize: 15,
    lineHeight: 25,
    marginRight: 6,
    fontWeight: '600',
  },
  bulletContent: {
    flex: 1,
    lineHeight: 25,
    fontSize: 16,
  },
  normalLine: {
    lineHeight: 25,
    fontSize: 16,
  },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inlineLink: {
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  codeBlock: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
  },
  codeBlockText: {
    fontFamily: 'monospace',
    fontSize: 13.5,
    lineHeight: 20,
  },
  tableScroll: {
    marginVertical: 8,
    width: '100%',
  },
  tableScrollContent: {
    paddingRight: 8,
  },
  tableBox: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  tableCellText: {
    fontSize: 13.5,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
});
