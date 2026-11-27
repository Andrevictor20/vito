import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { hapticFeedback } from '../../../theme/motion';
import { VitoSheet } from '../../../components/ui/VitoSheet';
import { formatRelativeTaskDate, getTaskDiffDays } from '../utils/taskBuckets';
import {
  qaParse,
  stripDateTokensFromDraft,
  stripPriorityTokensFromDraft,
  TaskListDef,
} from '../utils/taskQuickAddParser';

interface TaskQuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
  lists: TaskListDef[];
  defaultListId: string;
  onAddTask: (payload: {
    title: string;
    due_date?: string;
    priority?: string;
    category?: string;
  }) => Promise<void> | void;
}

export const TaskQuickAddSheet: React.FC<TaskQuickAddSheetProps> = ({
  visible,
  onClose,
  lists,
  defaultListId,
  onAddTask,
}) => {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [selectedList, setSelectedList] = useState(
    defaultListId && defaultListId !== 'all' ? defaultListId : lists[0]?.id || 'trabalho'
  );
  const [addedFeedback, setAddedFeedback] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedList(
        defaultListId && defaultListId !== 'all' ? defaultListId : lists[0]?.id || 'trabalho'
      );
    }
  }, [visible, defaultListId, lists]);

  const parsed = useMemo(() => qaParse(draft, lists), [draft, lists]);
  const activeListId = parsed.listId || selectedList;
  const activeList = lists.find((l) => l.id === activeListId) || lists[0];
  const relDate = parsed.dueDate ? formatRelativeTaskDate(parsed.dueDate) : null;
  const diffDays = parsed.dueDate ? getTaskDiffDays(parsed.dueDate) : null;

  const injectToken = (token: string) => {
    hapticFeedback.selection();
    let cleaned = draft;
    if (token === 'p1') {
      cleaned = stripPriorityTokensFromDraft(cleaned);
    } else {
      cleaned = stripDateTokensFromDraft(cleaned);
    }
    setDraft(`${cleaned ? `${cleaned} ` : ''}${token} `);
  };

  const handleSubmit = async () => {
    if (!parsed.title || submitting) return;
    setSubmitting(true);
    try {
      await onAddTask({
        title: parsed.title,
        due_date: parsed.dueDate || undefined,
        priority: parsed.priority || 'medium',
        category: activeList?.id || 'trabalho',
      });
      hapticFeedback.success();
      const nextN = addedCount + 1;
      setAddedCount(nextN);
      setAddedFeedback(`✓ “${parsed.title}” adicionada${nextN > 1 ? ` · ${nextN} nesta sessão` : ''}`);
      setDraft('');
    } catch {
      Alert.alert('Erro', 'Não foi possível criar a tarefa agora.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setAddedCount(0);
    setAddedFeedback('');
    onClose();
  };

  return (
    <VitoSheet
      visible={visible}
      onClose={handleClose}
      title="Nova tarefa"
      subtitle="Escreva como você fala — o Vito entende prazo, prioridade e lista"
    >
      <View style={styles.body}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surf,
              borderColor: colors.line,
              color: colors.ink,
            },
          ]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ex.: Ligar pro dentista amanhã p1 #pessoal"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          autoFocus
        />

        {/* Preview em tempo real (.qa-pv) */}
        {draft.trim().length > 0 && (
          <View style={styles.previewRow}>
            {relDate && (
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor:
                      diffDays !== null && diffDays < 0
                        ? colors.redBg
                        : diffDays === 0
                          ? colors.greenBg
                          : colors.surf,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    {
                      color:
                        diffDays !== null && diffDays < 0
                          ? colors.red
                          : diffDays === 0
                            ? colors.acc
                            : colors.ink,
                    },
                  ]}
                >
                  {relDate}
                </Text>
              </View>
            )}
            {activeList && (
              <View style={[styles.pill, { backgroundColor: colors.surf }]}>
                <View style={[styles.dot, { backgroundColor: activeList.color }]} />
                <Text style={[styles.pillText, { color: colors.ink }]}>{activeList.name}</Text>
              </View>
            )}
            {parsed.priority && (
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor:
                      parsed.priority === 'high' ? colors.redBg : colors.orangeBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: parsed.priority === 'high' ? colors.red : colors.orange },
                  ]}
                >
                  {parsed.priority === 'high' ? 'Alta' : 'Média'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tokens rápidos (.qa-q) */}
        <View style={styles.quickTokens}>
          {[
            { tok: 'hoje', label: 'Hoje' },
            { tok: 'amanhã', label: 'Amanhã' },
            { tok: 'sexta', label: 'Sexta' },
            { tok: 'p1', label: 'Prioridade alta' },
          ].map((q) => (
            <TouchableOpacity
              key={q.tok}
              style={[styles.tokenBtn, { backgroundColor: colors.surf, borderColor: colors.line }]}
              onPress={() => injectToken(q.tok)}
            >
              <Text style={[styles.tokenText, { color: colors.ink }]}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Lista</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listsRow}>
          {lists.map((l) => {
            const active = activeListId === l.id;
            return (
              <TouchableOpacity
                key={l.id}
                style={[
                  styles.listChip,
                  {
                    backgroundColor: active ? colors.ink : colors.surf,
                    borderColor: active ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setSelectedList(l.id);
                }}
              >
                <View style={[styles.dot, { backgroundColor: l.color }]} />
                <Text style={[styles.listChipText, { color: active ? colors.bg : colors.ink }]}>
                  {l.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {!!addedFeedback && (
          <Text style={[styles.feedback, { color: colors.acc }]}>{addedFeedback}</Text>
        )}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: colors.ink, opacity: !parsed.title || submitting ? 0.45 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={!parsed.title || submitting}
        >
          <Text style={[styles.submitBtnText, { color: colors.bg }]}>Adicionar tarefa</Text>
        </TouchableOpacity>
      </View>
    </VitoSheet>
  );
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  quickTokens: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tokenBtn: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  tokenText: { fontSize: 12.5, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
  },
  listsRow: { gap: 8 },
  listChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  listChipText: { fontSize: 12.5, fontWeight: '600' },
  feedback: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  submitBtn: {
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitBtnText: { fontSize: 15, fontWeight: '600' },
});
