import React from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { CloseSvgIcon } from '../../../icons/ProtoUiIcons'
import { useTheme } from '../../../context/ThemeContext'
import { loginPalette } from '../utils/loginPalette'
import { LEGAL_DOCS, type LegalDocKind } from '../utils/legalDocs'

export { LEGAL_DOCS, type LegalDocKind, type LegalDocContent, type LegalDocSection } from '../utils/legalDocs'

export interface LegalDocModalProps {
  doc: LegalDocKind | null
  onClose: () => void
}

export const LegalDocModal: React.FC<LegalDocModalProps> = ({ doc, onClose }) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)
  const content = doc ? LEGAL_DOCS[doc] : null

  return (
    <Modal
      visible={doc !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.scrim} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheet, { backgroundColor: palette.bg }]}>
          <View style={[styles.handle, { backgroundColor: palette.line }]} />

          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: palette.ink }]}>
                {content?.title}
              </Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>
                {content?.updatedAt}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={[styles.closeBtn, { backgroundColor: palette.btn }]}
            >
              <CloseSvgIcon size={18} color={palette.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {content?.sections.map((sec) => (
              <View key={sec.heading} style={styles.section}>
                <Text style={[styles.secHeading, { color: palette.ink }]}>
                  {sec.heading}
                </Text>
                <Text style={[styles.secBody, { color: palette.muted }]}>
                  {sec.body}
                </Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Fechar documento"
            style={[styles.doneBtn, { backgroundColor: palette.btn }]}
          >
            <Text style={[styles.doneText, { color: palette.ink }]}>
              Fechar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  } as ViewStyle,
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  } as ViewStyle,
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '80%',
  } as ViewStyle,
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  } as ViewStyle,
  headerText: {
    flex: 1,
  } as ViewStyle,
  title: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 22,
    letterSpacing: -0.44,
  } as TextStyle,
  subtitle: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13.5,
    marginTop: 2,
  } as TextStyle,
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  scroll: {
    marginBottom: 16,
  } as ViewStyle,
  section: {
    marginTop: 14,
  } as ViewStyle,
  secHeading: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    marginBottom: 4,
  } as TextStyle,
  secBody: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
  } as TextStyle,
  doneBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  doneText: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 14,
  } as TextStyle,
})
