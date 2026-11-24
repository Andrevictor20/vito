import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { BottomSheetModal } from '../../../components/ui/BottomSheetModal';
import { LEGAL_DOCS } from './StoreCatalogData';

export type StoreActiveSheet =
  | null
  | 'terms'
  | 'priv'
  | 'oss'
  | 'contact'
  | 'report'
  | 'rate'
  | 'export'
  | 'delete';

interface StoreSheetsProps {
  activeSheet: StoreActiveSheet;
  onClose: () => void;
  exportDone: boolean;
  onSendSupport: (msg: string) => Promise<void>;
  onReportAi: (reason: string) => Promise<void>;
  onRateApp: (stars: number) => void;
  onConfirmDelete: (confirmation: string) => Promise<void>;
}

export const StoreSheets: React.FC<StoreSheetsProps> = ({
  activeSheet,
  onClose,
  exportDone,
  onSendSupport,
  onReportAi,
  onRateApp,
  onConfirmDelete,
}) => {
  const { colors } = useTheme();
  const [supportMsg, setSupportMsg] = useState('');
  const [stars, setStars] = useState(0);
  const [delText, setDelText] = useState('');
  const [busy, setBusy] = useState(false);

  if (activeSheet === 'terms' || activeSheet === 'priv' || activeSheet === 'oss') {
    const doc = LEGAL_DOCS[activeSheet];
    return (
      <BottomSheetModal visible title={doc.title} subtitle={doc.subtitle} onClose={onClose}>
        <ScrollView contentContainerStyle={styles.body}>
          {doc.sections.map((s) => (
            <View key={s.heading} style={styles.docSec}>
              <Text style={[styles.docH, { color: colors.ink }]}>{s.heading}</Text>
              <Text style={[styles.docP, { color: colors.muted }]}>{s.body}</Text>
            </View>
          ))}
          <TouchableOpacity style={[styles.secBtn, { backgroundColor: colors.surf }]} onPress={onClose}>
            <Text style={[styles.secBtnText, { color: colors.ink }]}>Fechar</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>
    );
  }

  if (activeSheet === 'contact') {
    return (
      <BottomSheetModal visible title="Falar com o suporte" subtitle="Descreva o que aconteceu" onClose={onClose}>
        <View style={styles.body}>
          <TextInput
            style={[styles.textarea, { backgroundColor: colors.surf, borderColor: colors.line, color: colors.ink }]}
            value={supportMsg}
            onChangeText={setSupportMsg}
            multiline
            placeholder="Como podemos ajudar?"
            placeholderTextColor={colors.muted}
          />
          <TouchableOpacity
            style={[styles.priBtn, { backgroundColor: colors.ink, opacity: !supportMsg.trim() || busy ? 0.5 : 1 }]}
            disabled={!supportMsg.trim() || busy}
            onPress={async () => {
              setBusy(true);
              try {
                await onSendSupport(supportMsg.trim());
                setSupportMsg('');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Text style={[styles.priBtnText, { color: colors.bg }]}>Enviar mensagem</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    );
  }

  if (activeSheet === 'report') {
    const reasons = [
      'Informação incorreta',
      'Conteúdo ofensivo ou perigoso',
      'Vazamento de dados pessoais',
      'Outro motivo',
    ];
    return (
      <BottomSheetModal visible title="Denunciar resposta" subtitle="Ajude a tornar o Vito mais seguro" onClose={onClose}>
        <View style={styles.body}>
          <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
            {reasons.map((r, idx) => (
              <TouchableOpacity
                key={r}
                style={[styles.row, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}
                onPress={() => onReportAi(r)}
              >
                <Text style={[styles.rowTitle, { color: colors.ink }]}>{r}</Text>
                <ProtoUiIcon name="chevron-right" size={20} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BottomSheetModal>
    );
  }

  if (activeSheet === 'rate') {
    return (
      <BottomSheetModal visible title="Gostando do Vito?" subtitle="Sua avaliação ajuda muito" onClose={onClose}>
        <View style={styles.body}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setStars(n)} style={styles.starBtn}>
                <ProtoUiIcon
                  name={n <= stars ? 'star' : 'star-border'}
                  size={34}
                  color={n <= stars ? colors.fin : colors.muted}
                />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.priBtn, { backgroundColor: colors.ink, opacity: stars === 0 ? 0.4 : 1 }]}
            disabled={stars === 0}
            onPress={() => {
              const s = stars;
              setStars(0);
              onRateApp(s);
            }}
          >
            <Text style={[styles.priBtnText, { color: colors.bg }]}>
              {stars === 0 ? 'Selecione uma nota' : stars >= 4 ? 'Avaliar na loja' : 'Enviar feedback'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    );
  }

  if (activeSheet === 'export') {
    return (
      <BottomSheetModal visible title="Baixar meus dados" subtitle="Cópia completa em JSON" onClose={onClose}>
        <View style={[styles.body, { alignItems: 'center', paddingVertical: 20 }]}>
          {!exportDone ? (
            <>
              <ActivityIndicator size="large" color={colors.acc} />
              <Text style={[styles.docP, { color: colors.muted, marginTop: 12 }]}>
                Preparando arquivo LGPD em JSON…
              </Text>
            </>
          ) : (
            <>
              <ProtoUiIcon name="check-circle" size={40} color={colors.acc} />
              <Text style={[styles.docH, { color: colors.ink, textAlign: 'center' }]}>
                Pronto! Cópia JSON gerada e enviada para seu e-mail.
              </Text>
            </>
          )}
        </View>
      </BottomSheetModal>
    );
  }

  if (activeSheet === 'delete') {
    const canDelete = delText.trim().toUpperCase() === 'EXCLUIR';
    return (
      <BottomSheetModal
        visible
        title="Excluir conta?"
        subtitle="Esta ação é permanente após 30 dias"
        onClose={onClose}
      >
        <View style={styles.body}>
          <View style={[styles.warnBox, { backgroundColor: colors.redBg }]}>
            <Text style={[styles.docP, { color: colors.ink }]}>
              Serão removidos: conversas, agenda, tarefas, finanças, bots, memória e integrações. Assinaturas na loja devem ser canceladas nos ajustes da loja.
            </Text>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surf, borderColor: colors.line, color: colors.ink }]}
            value={delText}
            onChangeText={setDelText}
            placeholder="Digite EXCLUIR para confirmar"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.delBtn, { backgroundColor: colors.red, opacity: canDelete && !busy ? 1 : 0.4 }]}
            disabled={!canDelete || busy}
            onPress={async () => {
              setBusy(true);
              try {
                await onConfirmDelete(delText.trim().toUpperCase());
                setDelText('');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Text style={styles.delBtnText}>Excluir minha conta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secBtn, { backgroundColor: colors.surf }]} onPress={onClose}>
            <Text style={[styles.secBtnText, { color: colors.ink }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
  docSec: { gap: 4 },
  docH: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  docP: { fontSize: 13.5, lineHeight: 20 },
  textarea: {
    height: 110,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  input: { height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14.5 },
  priBtn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  priBtnText: { fontSize: 14.5, fontWeight: '600' },
  secBtn: { height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  secBtnText: { fontSize: 14, fontWeight: '600' },
  delBtn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  delBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  warnBox: { borderRadius: 16, padding: 12 },
  lst: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  rowTitle: { fontSize: 14.5, fontWeight: '500' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 8 },
  starBtn: { padding: 4 },
});
