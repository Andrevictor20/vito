import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { tokens } from '../../../theme/tokens';
import type { ByokSyncPhase } from '../../../hooks/useByokSetup';
import { BYOK_SYNC_CHECKPOINTS } from '../../../utils/byokFlow';
import { ActionButton, StatusBanner, getFinTokens } from './byokUi';
import { KeyPasteField } from './KeyPasteField';

interface Props {
  phase: Exclude<ByokSyncPhase, 'idle'>;
  completedCount: number;
  banks: string[];
  error: string;
  connectionItemId?: string;
  onUpdateItemId?: (v: string) => void;
  onPasteItemId?: () => void;
  onSyncWithItemId?: (id?: string) => void;
  onRetrySync: () => void;
  onBack: () => void;
  onFinish: () => void;
}

/**
 * Telas `syncV` (6 checkpoints) e `doneV` ("Vito Finance conectado")
 * fiéis a `#s-fon` em `Vito-telas-atualizadas.html`.
 */
export const ByokSyncProgress: React.FC<Props> = ({
  phase,
  completedCount,
  banks,
  error,
  connectionItemId,
  onUpdateItemId,
  onPasteItemId,
  onSyncWithItemId,
  onRetrySync,
  onBack,
  onFinish,
}) => {
  const { colors, isDark } = useTheme();
  const { fin, finBg } = getFinTokens(colors, isDark);

  if (phase === 'done') {
    const activeBanks = banks.length > 0 ? banks : ['Meu Pluggy'];
    return (
      <View style={styles.doneWrap}>
        <View style={[styles.sealBig, { backgroundColor: colors.acc }]}>
          <MaterialIcons name="check" size={30} color="#FFFFFF" />
        </View>
        <Text style={[styles.heading, { color: colors.ink, marginTop: 20 }]}>Vito Finance conectado</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Importei seus dados financeiros. Daqui para frente o Vito sincroniza sozinho e avisa o que importa.
        </Text>

        <View style={styles.bankList}>
          {activeBanks.map((bank) => (
            <View key={bank} style={[styles.bankCard, { borderColor: colors.line, backgroundColor: colors.bg }]}>
              <View style={[styles.bankChip, { backgroundColor: finBg }]}>
                <MaterialIcons name="account-balance" size={20} color={fin} />
              </View>
              <View style={styles.bankBody}>
                <Text style={[styles.bankName, { color: colors.ink }]} numberOfLines={1}>
                  {bank}
                </Text>
                <Text style={[styles.bankMeta, { color: colors.muted }]}>Somente leitura · atualizado agora</Text>
              </View>
              <View style={[styles.activePill, { backgroundColor: colors.greenBg }]}>
                <View style={[styles.activeDot, { backgroundColor: colors.acc }]} />
                <Text style={[styles.activeText, { color: colors.acc }]}>Ativo</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <ActionButton primary label="Ver minhas finanças" onPress={onFinish} style={styles.pillFull} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.syncWrap}>
      <Text style={[styles.heading, { color: colors.ink, marginTop: 18 }]}>Sincronizando</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Tudo sai do seu celular. O servidor só recebe os dados já prontos.
      </Text>

      <View style={styles.ckList}>
        {BYOK_SYNC_CHECKPOINTS.map((cp, index) => {
          const done = index < completedCount;
          return (
            <View key={cp.title} style={styles.ckRow}>
              <View
                style={[
                  styles.ckCircle,
                  {
                    borderColor: done ? colors.acc : colors.line,
                    backgroundColor: done ? colors.acc : 'transparent',
                  },
                ]}
              >
                {done ? <MaterialIcons name="check" size={14} color="#FFFFFF" /> : null}
              </View>
              <View style={styles.ckBody}>
                <Text style={[styles.ckTitle, { color: done ? colors.ink : colors.muted }]}>{cp.title}</Text>
                <Text style={[styles.ckSub, { color: colors.muted }]}>{cp.subtitle}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {(phase === 'waiting_auth' || phase === 'error') && (
        <View style={styles.retryBox}>
          <StatusBanner
            kind="bad"
            title={phase === 'waiting_auth' ? 'Aguardando a sua autorização' : 'Falha na sincronização'}
            subtitle={error || 'Conclua no Pluggy Connect para continuar.'}
          />

          {phase === 'waiting_auth' && onSyncWithItemId && (
            <View style={[styles.manualBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
              <Text style={[styles.manualTitle, { color: colors.ink }]}>Já autorizou no navegador?</Text>
              <Text style={[styles.manualDesc, { color: colors.muted }]}>
                No Dashboard da Pluggy (Aplicações → sua aplicação → Itens Conectados), copie o ID da Conexão (Item ID) e cole aqui:
              </Text>
              <KeyPasteField
                label="ID da Conexão (Item ID)"
                value={connectionItemId || ''}
                onChangeText={onUpdateItemId || (() => {})}
                onPaste={onPasteItemId || (() => {})}
              />
              <ActionButton
                primary
                icon="sync"
                label="Sincronizar com este ID"
                disabled={!connectionItemId}
                onPress={() => onSyncWithItemId(connectionItemId)}
                style={{ marginTop: 8 }}
              />
            </View>
          )}

          <ActionButton
            label="Reabrir Pluggy Connect no Navegador"
            onPress={onRetrySync}
            style={[styles.pillFull, { marginTop: 10 }]}
          />
          <TouchableOpacity onPress={onBack} style={styles.backLink} accessibilityRole="button">
            <Text style={[styles.backLinkText, { color: colors.muted }]}>Voltar às etapas</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  syncWrap: { flex: 1 },
  doneWrap: { flex: 1, paddingTop: 28 },
  sealBig: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heading: {
    fontSize: 28,
    lineHeight: 33,
    fontFamily: tokens.typography.family.montserratBold,
    letterSpacing: -0.6,
  },
  sub: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  ckList: { marginTop: 10 },
  ckRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  ckCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ckBody: { flex: 1, minWidth: 0 },
  ckTitle: { fontSize: 15, fontWeight: '500' },
  ckSub: { fontSize: 12, marginTop: 2 },
  retryBox: { marginTop: 16 },
  manualBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  manualTitle: { fontSize: 13.5, fontWeight: '700' },
  manualDesc: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  backLink: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  backLinkText: { fontSize: 14, fontWeight: '600' },
  bankList: { marginTop: 22, gap: 10 },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  bankChip: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bankBody: { flex: 1, minWidth: 0 },
  bankName: { fontSize: 15.5, fontWeight: '600' },
  bankMeta: { fontSize: 12.5, marginTop: 2 },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { fontSize: 12, fontWeight: '600' },
  footer: { marginTop: 24 },
  pillFull: { height: 52, borderRadius: 26 },
});