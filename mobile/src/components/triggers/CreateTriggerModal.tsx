import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import {
  CreateTriggerInput,
  TriggerCategory,
  TriggerFrequency,
  TRIGGER_CATEGORIES,
} from '../../types';

interface CreateTriggerModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTriggerInput) => Promise<any>;
}

export const CreateTriggerModal: React.FC<CreateTriggerModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { colors, isDark } = useTheme();
  const [mode, setMode] = useState<'prompt' | 'form'>('prompt');
  const [promptText, setPromptText] = useState('');
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TriggerCategory>('finance');
  const [frequency, setFrequency] = useState<TriggerFrequency>('daily_morning');
  const [submitting, setSubmitting] = useState(false);

  const quickExamples = [
    { text: 'Acompanhe as ações da PETR3 e avise se passar de R$ 35', cat: 'finance' },
    { text: 'Avise se voos GRU para JFK ficarem abaixo de R$ 3.000 em dezembro', cat: 'travel' },
    { text: 'Acompanhe o próximo jogo do Flamengo e onde vai passar', cat: 'events_sports' },
    { text: 'Monitore o lote de restituição do IRPF 2026', cat: 'taxes_docs' },
    { text: 'Monitore o preço do MacBook Air M3 abaixo de R$ 7.500', cat: 'shopping' },
    { text: 'Avise-me se houver alerta de chuva forte no sábado', cat: 'weather' },
  ];

  const handleApplyExample = (ex: { text: string; cat: string }) => {
    setPromptText(ex.text);
    setTitle(ex.text.slice(0, 40) + '...');
    setQuery(ex.text);
    setSelectedCategory(ex.cat as TriggerCategory);
  };

  const handleSave = async () => {
    let finalTitle = title.trim();
    let finalQuery = query.trim();
    let finalCategory = selectedCategory;

    if (mode === 'prompt') {
      if (!promptText.trim()) {
        Alert.alert('Atenção', 'Por favor, digite o que você gostaria que o Vito monitorasse.');
        return;
      }
      finalTitle = promptText.trim().length > 45 ? promptText.trim().slice(0, 42) + '...' : promptText.trim();
      finalQuery = promptText.trim();
    } else {
      if (!finalTitle) {
        Alert.alert('Atenção', 'Informe o título do radar.');
        return;
      }
      if (!finalQuery) {
        Alert.alert('Atenção', 'Informe o que o Vito deve vigiar.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: finalTitle,
        query: finalQuery,
        category: finalCategory,
        frequency,
      });
      // Limpar formulário
      setPromptText('');
      setTitle('');
      setQuery('');
      onClose();
    } catch (err: any) {
      Alert.alert('Erro ao criar radar', err?.message || 'Tente novamente em instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? colors.surfaceContainer : '#FFFFFF',
              borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {/* Header do Modal */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleGroup}>
              <View
                style={[
                  styles.headerIconCircle,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
                ]}
              >
                <MaterialIcons name="track-changes" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                  Novo Radar
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.onSurfaceVariant }]}>
                  O Vito pesquisa e avisa das novidades
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons
                name="close"
                size={22}
                color={isDark ? '#A1A1AA' : '#71717A'}
              />
            </TouchableOpacity>
          </View>

          {/* Seletor de Modo: Linguagem Natural vs Estruturado */}
          <View
            style={[
              styles.modeSegment,
              { backgroundColor: isDark ? colors.surfaceContainerLowest : '#F4F4F5' },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'prompt' && [
                  styles.modeTabActive,
                  { backgroundColor: isDark ? colors.surfaceContainerHighest : '#FFFFFF' },
                ],
              ]}
              onPress={() => setMode('prompt')}
            >
              <MaterialIcons
                name="chat-bubble-outline"
                size={16}
                color={mode === 'prompt' ? colors.primary : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.modeTabText,
                  {
                    color: mode === 'prompt' ? colors.onSurface : colors.onSurfaceVariant,
                    fontWeight: mode === 'prompt' ? '700' : '500',
                  },
                ]}
              >
                Linguagem Natural
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'form' && [
                  styles.modeTabActive,
                  { backgroundColor: isDark ? colors.surfaceContainerHighest : '#FFFFFF' },
                ],
              ]}
              onPress={() => setMode('form')}
            >
              <MaterialIcons
                name="list-alt"
                size={16}
                color={mode === 'form' ? colors.primary : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.modeTabText,
                  {
                    color: mode === 'form' ? colors.onSurface : colors.onSurfaceVariant,
                    fontWeight: mode === 'form' ? '700' : '500',
                  },
                ]}
              >
                Categorias Guiadas
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {mode === 'prompt' ? (
              <View style={styles.promptSection}>
                <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>
                  Diga ao Vito o que você quer acompanhar:
                </Text>
                <View
                  style={[
                    styles.textAreaContainer,
                    {
                      backgroundColor: isDark ? colors.surfaceContainerLowest : '#FAFAFA',
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <RNTextInput
                    style={[styles.textArea, { color: colors.onSurface }]}
                    placeholder="Ex: Avise-me se as ações da AAPL subirem mais de 3% hoje, ou se o voo para Orlando cair de preço..."
                    placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                    multiline
                    numberOfLines={4}
                    value={promptText}
                    onChangeText={setPromptText}
                    textAlignVertical="top"
                  />
                </View>

                {/* Exemplos Rápidos Tocáveis */}
                <Text style={[styles.examplesHeading, { color: colors.onSurfaceVariant }]}>
                  Sugestões práticas para testar:
                </Text>
                <View style={styles.examplesGrid}>
                  {quickExamples.map((ex, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.examplePill,
                        {
                          backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                          borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
                        },
                      ]}
                      onPress={() => handleApplyExample(ex)}
                    >
                      <MaterialIcons name="touch-app" size={14} color={colors.primary} />
                      <Text
                        style={[styles.exampleText, { color: colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {ex.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.formSection}>
                {/* Seleção de Categoria (Grid das 12 Categorias) */}
                <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>
                  Escolha uma das 12 categorias:
                </Text>
                <View style={styles.categoriesGrid}>
                  {TRIGGER_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const catColor = isDark ? cat.colorDark : cat.colorLight;
                    const catBg = isDark ? cat.bgDark : cat.bgLight;

                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryCard,
                          {
                            backgroundColor: isSelected
                              ? catBg
                              : isDark
                              ? colors.surfaceContainerLowest
                              : '#FAFAFA',
                            borderColor: isSelected ? catColor : colors.outlineVariant,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        onPress={() => {
                          setSelectedCategory(cat.id);
                          if (!title) setTitle(cat.label);
                        }}
                      >
                        <MaterialIcons
                          name={cat.icon as any}
                          size={18}
                          color={isSelected ? catColor : isDark ? '#A1A1AA' : '#71717A'}
                        />
                        <Text
                          style={[
                            styles.categoryCardText,
                            {
                              color: isSelected ? catColor : colors.onSurface,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Título */}
                <Text style={[styles.fieldLabel, { color: colors.onSurface, marginTop: 12 }]}>
                  Título do Radar:
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? colors.surfaceContainerLowest : '#FAFAFA',
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <RNTextInput
                    style={[styles.input, { color: colors.onSurface }]}
                    placeholder="Ex: Ações da PETR3"
                    placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                {/* Condição / O que vigiar */}
                <Text style={[styles.fieldLabel, { color: colors.onSurface, marginTop: 10 }]}>
                  O que vigiar:
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? colors.surfaceContainerLowest : '#FAFAFA',
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <RNTextInput
                    style={[styles.input, { color: colors.onSurface }]}
                    placeholder="Ex: Acima de R$ 35,00"
                    placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                    value={query}
                    onChangeText={setQuery}
                  />
                </View>
              </View>
            )}

            {/* Frequência de Verificação */}
            <Text style={[styles.fieldLabel, { color: colors.onSurface, marginTop: 14 }]}>
              Frequência de Atualização:
            </Text>
            <View style={styles.frequencyRow}>
              {[
                { id: 'daily_morning', label: 'Matinal (08h)' },
                { id: 'hourly', label: 'Horária' },
                { id: 'immediate', label: 'Imediata' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.frequencyPill,
                    {
                      backgroundColor:
                        frequency === f.id
                          ? isDark
                            ? colors.surfaceContainerHighest
                            : colors.primary
                          : isDark
                          ? colors.surfaceContainerLowest
                          : '#F4F4F5',
                      borderColor: frequency === f.id ? colors.primary : colors.outlineVariant,
                    },
                  ]}
                  onPress={() => setFrequency(f.id as TriggerFrequency)}
                >
                  <Text
                    style={[
                      styles.frequencyPillText,
                      {
                        color:
                          frequency === f.id
                            ? '#FFFFFF'
                            : isDark
                            ? colors.onSurfaceVariant
                            : '#71717A',
                        fontWeight: frequency === f.id ? '700' : '500',
                      },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Botões do Rodapé */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: colors.outlineVariant },
              ]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={[styles.cancelButtonText, { color: colors.onSurface }]}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleSave}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <MaterialIcons name="add" size={18} color={colors.onPrimary} />
                  <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Criar Radar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
  },
  modeSegment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 12,
    marginLeft: 6,
  },
  scrollBody: {
    maxHeight: 400,
  },
  promptSection: {
    marginBottom: 8,
  },
  formSection: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textAreaContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  textArea: {
    fontSize: 14,
    minHeight: 80,
  },
  examplesHeading: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  examplesGrid: {
    gap: 6,
  },
  examplePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  exampleText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    width: '48%',
  },
  categoryCardText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  inputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    fontSize: 14,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  frequencyPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  frequencyPillText: {
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
