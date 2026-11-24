import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon, type ProtoUiIconName } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { v5Radii } from '../../../theme/tokens';
import { hapticFeedback } from '../../../theme/motion';

export type ChatAttachmentOption = 'camera' | 'gallery' | 'pdf';

interface ChatAttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: ChatAttachmentOption) => void;
}

const OPTIONS: ReadonlyArray<{
  id: ChatAttachmentOption;
  icon: ProtoUiIconName;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'camera',
    icon: 'photo-camera',
    title: 'Tirar foto',
    subtitle: 'Ler boleto, convite ou anotação',
  },
  {
    id: 'gallery',
    icon: 'photo-library',
    title: 'Galeria de fotos',
    subtitle: 'Enviar print ou comprovante',
  },
  {
    id: 'pdf',
    icon: 'description',
    title: 'Arquivo ou PDF',
    subtitle: 'Faturas, contratos e documentos',
  },
];

/**
 * Sheet v5 de anexos do Chat (.sheet2) fiel a Vito-telas-atualizadas.html (#c-attach).
 */
export const ChatAttachmentSheet: React.FC<ChatAttachmentSheetProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Fechar menu de anexos"
        />

        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
          <TouchableOpacity
            style={styles.handleHit}
            onPress={onClose}
            accessibilityLabel="Fechar"
            activeOpacity={0.8}
          >
            <View style={[styles.handleBar, { backgroundColor: colors.line }]} />
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.ink }]}>Anexar ao chat</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                O Vito lê imagens e PDFs automaticamente
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.closeBtn,
                { backgroundColor: colors.surf, borderColor: colors.line },
              ]}
              onPress={onClose}
              accessibilityLabel="Fechar"
              activeOpacity={0.75}
            >
              <ProtoUiIcon name="close" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.listCard,
              {
                backgroundColor: colors.surf,
                borderColor: colors.hairline,
              },
            ]}
          >
            {OPTIONS.map((opt, idx) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.listRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline },
                ]}
                onPress={() => {
                  hapticFeedback.light();
                  onClose();
                  onSelectOption(opt.id);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={opt.title}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
                  <ProtoUiIcon name={opt.icon} size={18} color={colors.ink} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]}>{opt.title}</Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>{opt.subtitle}</Text>
                </View>
                <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
  },
  sheet: {
    borderTopLeftRadius: v5Radii.sheet,
    borderTopRightRadius: v5Radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 16,
  },
  handleHit: {
    alignItems: 'center',
    paddingVertical: 7,
    marginBottom: 4,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Geist',
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 13,
    marginTop: 3,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -4,
  },
  listCard: {
    borderRadius: v5Radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 58,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: 'Geist',
    fontSize: 15,
    fontWeight: '500',
  },
  rowSub: {
    fontFamily: 'Geist',
    fontSize: 13,
    marginTop: 2,
  },
});
