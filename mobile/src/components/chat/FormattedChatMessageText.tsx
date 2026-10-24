import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

const renderInlineFormatted = (raw: string, textColor: string, isDark: boolean) => {
  if (!raw) return null;

  // Regex para capturar tanto negrito **bold** quanto código inline `code`
  const tokenRegex = /(\*\*[^*]+?\*\*|`[^`]+?`)/g;
  const parts = raw.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <Text key={idx} style={{ fontWeight: '700', color: textColor }}>
          {boldText}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeText = part.slice(1, -1);
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
          {codeText}
        </Text>
      );
    }
    // Remove asteriscos soltos indesejados
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

export const FormattedChatMessageText: React.FC<FormattedChatMessageTextProps> = ({
  text,
  isUser,
  style,
  textColor,
  isDark = false,
}) => {
  if (!text) return null;

  if (isUser) {
    return <Text style={[style, { color: textColor }]}>{text}</Text>;
  }

  const lines = text.split('\n');
  let insideCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  const renderedElements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Tratamento de bloco de código ```
    if (trimmed.startsWith('```')) {
      if (insideCodeBlock) {
        // Fecha o bloco de código
        const codeContent = codeBlockBuffer.join('\n');
        renderedElements.push(
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
            <Text style={[styles.codeBlockText, { color: textColor }]}>
              {codeContent}
            </Text>
          </View>
        );
        codeBlockBuffer = [];
        insideCodeBlock = false;
      } else {
        // Abre o bloco de código
        insideCodeBlock = true;
      }
      return;
    }

    if (insideCodeBlock) {
      codeBlockBuffer.push(line);
      return;
    }

    // Linha em branco -> espaçamento de parágrafo editorial
    if (!trimmed) {
      renderedElements.push(
        <View key={`space-${lineIdx}`} style={styles.paragraphSpacer} />
      );
      return;
    }

    // Títulos Markdown (# Título, ## Subtítulo, ### Seção)
    if (/^#{1,4}\s+/.test(trimmed)) {
      const headerClean = trimmed.replace(/^#{1,4}\s+/, '').trim();
      renderedElements.push(
        <Text key={`header-${lineIdx}`} style={[style, styles.headerLine, { color: textColor }]}>
          {renderInlineFormatted(headerClean, textColor, isDark)}
        </Text>
      );
      return;
    }

    // Marcadores de lista não numerada (* Item, - Item, • Item)
    if (/^[\*\-\+•]\s+/.test(trimmed)) {
      const bulletClean = trimmed.replace(/^[\*\-\+•]\s+/, '').trim();
      renderedElements.push(
        <View key={`bullet-${lineIdx}`} style={styles.bulletRow}>
          <Text style={[styles.bulletSymbol, { color: textColor }]}>•</Text>
          <Text style={[style, styles.bulletContent, { color: textColor }]}>
            {renderInlineFormatted(bulletClean, textColor, isDark)}
          </Text>
        </View>
      );
      return;
    }

    // Marcadores de lista numerada (1. Item, 2) Item)
    const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
    if (numberedMatch) {
      const number = numberedMatch[1];
      const content = numberedMatch[2];
      renderedElements.push(
        <View key={`num-${lineIdx}`} style={styles.bulletRow}>
          <Text style={[styles.numberedSymbol, { color: textColor }]}>{number}.</Text>
          <Text style={[style, styles.bulletContent, { color: textColor }]}>
            {renderInlineFormatted(content, textColor, isDark)}
          </Text>
        </View>
      );
      return;
    }

    // Linha de texto normal com entrelinha espaçosa
    renderedElements.push(
      <Text key={`normal-${lineIdx}`} style={[style, styles.normalLine, { color: textColor }]}>
        {renderInlineFormatted(line, textColor, isDark)}
      </Text>
    );
  });

  return <View style={styles.formattedContainer}>{renderedElements}</View>;
};

const styles = StyleSheet.create({
  formattedContainer: {
    gap: 3,
    width: '100%',
  },
  paragraphSpacer: {
    height: 10,
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
});
