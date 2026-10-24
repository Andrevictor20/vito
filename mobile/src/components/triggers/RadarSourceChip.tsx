import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  Linking,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { TriggerSourceItem, getFaviconUrl } from '../../utils/radarReportUtils';

interface RadarSourceChipProps {
  source: TriggerSourceItem;
}

export const RadarSourceChip: React.FC<RadarSourceChipProps> = ({ source }) => {
  const { colors } = useTheme();
  const [imageError, setImageError] = useState(false);

  const favicon = source.domain ? getFaviconUrl(source.domain) : getFaviconUrl(source.url);

  const handlePress = () => {
    if (!source.url) return;
    Linking.openURL(source.url).catch(() => {});
  };

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: colors.surf,
          borderColor: colors.line,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`Abrir notícia em ${source.name}`}
    >
      {favicon && !imageError ? (
        <Image
          source={{ uri: favicon }}
          style={styles.favicon}
          onError={() => setImageError(true)}
        />
      ) : (
        <MaterialIcons name="public" size={13} color={colors.muted} />
      )}

      <Text
        style={[styles.nameText, { color: colors.ink }]}
        numberOfLines={1}
      >
        {source.name}
      </Text>

      <MaterialIcons name="arrow-outward" size={12} color={colors.muted} />
    </TouchableOpacity>
  );
};

interface RadarSourcesRowProps {
  sources: TriggerSourceItem[];
}

export const RadarSourcesRow: React.FC<RadarSourcesRowProps> = ({ sources }) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <View style={styles.sourcesContainer}>
      <Text style={styles.sourcesLabel}>FONTES VERIFICADAS</Text>
      <View style={styles.sourcesRow}>
        {sources.map((src, i) => (
          <RadarSourceChip key={`src-${i}-${src.url}`} source={src} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sourcesContainer: {
    marginTop: 10,
    paddingTop: 8,
  },
  sourcesLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#8A928F',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
  },
  favicon: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  nameText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 140,
  },
});
