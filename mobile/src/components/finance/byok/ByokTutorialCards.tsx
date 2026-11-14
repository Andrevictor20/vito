import React, { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { tokens } from '../../../theme/tokens';
import { getFinTokens } from './byokUi';

const CARDS: { icon: keyof typeof MaterialIcons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'lock-outline',
    title: 'Privacidade total',
    text: 'Sem intermediários: você cria a sua própria chave na Pluggy e os dados vão do seu celular direto para o seu servidor pessoal.',
  },
  {
    icon: 'vpn-key',
    title: 'A chave da API',
    text: 'Mostramos onde clicar no painel da Pluggy para copiar o Client ID e o Client Secret. Leva menos de 1 minuto.',
  },
  {
    icon: 'account-balance',
    title: 'Conexão dos bancos',
    text: 'Os bancos são vinculados no Meu Pluggy, com a biometria do próprio app do banco.',
  },
];

interface Props {
  onDone: () => void;
}

/** Mini-tutorial `#s-fon` (`tutV` em Vito-telas-atualizadas.html): ícone 64×64 `--fin`, pílula ativa 22px. */
export const ByokTutorialCards: React.FC<Props> = ({ onDone }) => {
  const { colors, isDark } = useTheme();
  const { fin, finBg } = getFinTokens(colors, isDark);
  const { width } = useWindowDimensions();
  const cardW = Math.max(width - 44, 260);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const last = index === CARDS.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIdx = Math.round(e.nativeEvent.contentOffset.x / cardW);
    if (nextIdx >= 0 && nextIdx < CARDS.length) setIndex(nextIdx);
  };

  const next = () => {
    if (last) return onDone();
    const target = index + 1;
    setIndex(target);
    listRef.current?.scrollToIndex({ index: target, animated: true });
  };

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={CARDS}
        keyExtractor={(c) => c.title}
        horizontal
        pagingEnabled
        snapToInterval={cardW}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        getItemLayout={(_, i) => ({ length: cardW, offset: cardW * i, index: i })}
        renderItem={({ item, index: itemIdx }) => (
          <View style={[styles.slide, { width: cardW }]}>
            <View style={[styles.chipBig, { backgroundColor: finBg }]}>
              <MaterialIcons name={item.icon} size={30} color={fin} />
            </View>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>{itemIdx + 1} DE 3</Text>
            <Text style={[styles.title, { color: colors.ink }]}>{item.title}</Text>
            <Text style={[styles.text, { color: colors.muted }]}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {CARDS.map((c, i) => {
          const active = i === index;
          return (
            <View
              key={c.title}
              style={[styles.dot, { width: active ? 22 : 7, backgroundColor: active ? colors.ink : colors.line }]}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.ink }]}
          onPress={next}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={last ? 'Começar configuração' : 'Próximo card'}
        >
          <Text style={[styles.btnText, { color: colors.bg }]}>{last ? 'Começar' : 'Próximo'}</Text>
        </TouchableOpacity>
        {!last && (
          <TouchableOpacity onPress={onDone} style={styles.skip} hitSlop={tokens.hitSlop.sm} accessibilityRole="button">
            <Text style={[styles.skipText, { color: colors.muted }]}>Pular</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 32 },
  slide: { paddingRight: 8 },
  chipBig: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7, marginTop: 22 },
  title: {
    fontSize: 28,
    lineHeight: 33,
    fontFamily: tokens.typography.family.montserratBold,
    letterSpacing: -0.6,
    marginTop: 8,
  },
  text: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 28 },
  dot: { height: 7, borderRadius: 4 },
  footer: { marginTop: 32 },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
  skip: { alignItems: 'center', justifyContent: 'center', height: 40, marginTop: 6 },
  skipText: { fontSize: 14, fontWeight: '600' },
});
