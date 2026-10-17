import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

const renderInlineFormatted = (raw: string, textColor: string) => {
  if (!raw) return null;

  // Remove caracteres markdown crus residuais como hashtags soltas
  const clean = raw.replace(/^#+\s*/, '');

  // Divide por delimitadores de negrito **
  const parts = clean.split(/(\*\*[^*]+?\*\*)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <Text key={idx} style={{ fontWeight: '700', color: textColor }}>
          {boldText}
        </Text>
      );
    }
    // Remove asteriscos soltos indesejados da parte comum
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
}

export const FormattedChatMessageText: React.FC<FormattedChatMessageTextProps> = ({
  text,
  isUser,
  style,
  textColor,
}) => {
  if (!text) return null;

  if (isUser) {
    return <Text style={[style, { color: textColor }]}>{text}</Text>;
  }

  const lines = text.split('\n');

  return (
    <View style={styles.formattedContainer}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={lineIdx} style={styles.paragraphSpacer} />;
        }

        // Títulos Markdown (# Título, ## Subtítulo)
        if (/^#{1,4}\s+/.test(trimmed)) {
          const headerClean = trimmed.replace(/^#{1,4}\s+/, '').trim();
          return (
            <Text key={lineIdx} style={[style, styles.headerLine, { color: textColor }]}>
              {renderInlineFormatted(headerClean, textColor)}
            </Text>
          );
        }

        // Marcadores de lista (* Item, - Item, + Item)
        if (/^[\*\-\+]\s+/.test(trimmed)) {
          const bulletClean = trimmed.replace(/^[\*\-\+]\s+/, '').trim();
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.bulletSymbol, { color: textColor }]}>•</Text>
              <Text style={[style, styles.bulletContent, { color: textColor }]}>
                {renderInlineFormatted(bulletClean, textColor)}
              </Text>
            </View>
          );
        }

        // Linha normal
        return (
          <Text key={lineIdx} style={[style, styles.normalLine, { color: textColor }]}>
            {renderInlineFormatted(line, textColor)}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  formattedContainer: {
    gap: 3,
  },
  paragraphSpacer: {
    height: 8,
  },
  headerLine: {
    fontWeight: '700',
    fontSize: 15,
    marginTop: 4,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 2,
    marginVertical: 1.5,
  },
  bulletSymbol: {
    fontSize: 14,
    lineHeight: 20,
    marginRight: 6,
    fontWeight: '700',
  },
  bulletContent: {
    flex: 1,
    lineHeight: 20,
  },
  normalLine: {
    lineHeight: 20,
  },
});
