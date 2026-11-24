import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { tokens } from '../../../../theme/tokens';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';
import { BottomSheetModal } from '../../../../components/ui/BottomSheetModal';
import {
  TASK_LIST_COLORS,
  TaskListDef,
} from '../../utils/taskQuickAddParser';

interface TaskListChipsProps {
  lists: TaskListDef[];
  selectedListId: string;
  onSelectList: (listId: string) => void;
  countsByList: Record<string, number>;
  onCreateList: (list: TaskListDef) => void;
}

export const TaskListChips: React.FC<TaskListChipsProps> = ({
  lists,
  selectedListId,
  onSelectList,
  countsByList,
  onCreateList,
}) => {
  const { colors } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TASK_LIST_COLORS[0]);

  const handleSave = () => {
    const trimmed = name.trim() || 'Nova lista';
    const id = `list_${Date.now()}`;
    onCreateList({ id, name: trimmed, color: selectedColor });
    onSelectList(id);
    setName('');
    setModalOpen(false);
  };

  return (
    <>
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          <TouchableOpacity
            style={[
              styles.chip,
              {
                backgroundColor: selectedListId === 'all' ? colors.ink : colors.surf,
              },
            ]}
            onPress={() => {
              hapticFeedback.selection();
              onSelectList('all');
            }}
          >
            <Text
              style={[
                styles.chipText,
                { color: selectedListId === 'all' ? colors.bg : colors.ink },
              ]}
            >
              Todas as listas
            </Text>
          </TouchableOpacity>

          {lists.map((l) => {
            const active = selectedListId === l.id;
            const count = countsByList[l.id] || 0;
            return (
              <TouchableOpacity
                key={l.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.ink : colors.surf,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  onSelectList(active ? 'all' : l.id);
                }}
              >
                <View style={[styles.dot, { backgroundColor: l.color }]} />
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.bg : colors.ink },
                  ]}
                >
                  {l.name}
                </Text>
                <Text
                  style={[
                    styles.countText,
                    { color: active ? colors.bg : colors.muted },
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surf },
            ]}
            onPress={() => {
              hapticFeedback.selection();
              setModalOpen(true);
            }}
            accessibilityLabel="Criar nova lista"
          >
            <Text style={[styles.chipText, { color: colors.ink }]}>+ Lista</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <BottomSheetModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova lista"
        subtitle="Organize tarefas e subtarefas por contexto"
      >
        <View style={styles.sheetBody}>
          <Text style={[styles.fieldLabel, { color: colors.ink }]}>Nome da lista</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surf,
                borderColor: colors.line,
                color: colors.ink,
              },
            ]}
            placeholder="Ex.: Casa, Viagem Rio, Estudos"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 14 }]}>
            Cor da lista
          </Text>
          <View style={styles.colorsRow}>
            {TASK_LIST_COLORS.map((c, idx) => {
              const active = selectedColor === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorChip,
                    {
                      backgroundColor: active ? colors.ink : colors.surf,
                      borderColor: active ? colors.ink : colors.line,
                    },
                  ]}
                  onPress={() => setSelectedColor(c)}
                >
                  <View style={[styles.dot, { backgroundColor: c }]} />
                  <Text
                    style={[
                      styles.colorText,
                      { color: active ? colors.bg : colors.ink },
                    ]}
                  >
                    Cor {idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.ink }]}
            onPress={handleSave}
          >
            <Text style={[styles.saveBtnText, { color: colors.bg }]}>Criar lista</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 4 },
  scrollRow: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 0,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Geist_500Medium',
  },
  countText: {
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
    opacity: 0.78,
  },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 24 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14.5,
  },
  colorsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
  },
  colorText: { fontSize: 12.5, fontWeight: '600' },
  saveBtn: {
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  saveBtnText: { fontSize: 14.5, fontWeight: '600' },
});
