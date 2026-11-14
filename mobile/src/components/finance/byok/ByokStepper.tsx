import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { tokens } from '../../../theme/tokens';
import type { useByokSetup } from '../../../hooks/useByokSetup';
import { isStepUnlocked } from '../../../utils/byokFlow';
import { canValidate, maskClientIdShort } from '../../../utils/pluggyKeys';
import { KeyPasteField } from './KeyPasteField';
import { ActionButton, ErrorText, StatusBanner, VerticalStep } from './byokUi';

type Setup = ReturnType<typeof useByokSetup>;

const stateOf = (n: '1' | '2' | '3', s: Setup): 'locked' | 'active' | 'done' => {
  const order = { '1': 1, '2': 2, '3': 3, tutorial: 0, done: 4 } as const;
  if (order[s.step] > order[n]) return 'done';
  if (order[s.step] === order[n] && isStepUnlocked(n, s.step, s.validated)) return 'active';
  return 'locked';
};

/** Stepper vertical `#s-fon` (`mainV` em Vito-telas-atualizadas.html) com WebView na Etapa 1. */
export const ByokStepper: React.FC<{ setup: Setup }> = ({ setup: s }) => {
  const { colors } = useTheme();
  const s1State = stateOf('1', s);
  const s2State = stateOf('2', s);
  const s3State = stateOf('3', s);
  const lockedStep1 = s.authStatus === 'validating' || s.validated;
  const fieldInvalid = s.authStatus === 'error' || s.authStatus === 'offline';

  const chipLabel =
    s.clipboardUuids.length > 1
      ? 'Colar Client ID e Secret detectados'
      : s.clipboardUuids.length === 1
        ? `Colar ${s.clientId ? 'Client Secret' : 'Client ID'} detectado (${maskClientIdShort(s.clipboardUuids[0])})`
        : '';

  return (
    <View>
      <Text style={[styles.heading, { color: colors.ink }]}>Conecte seus bancos</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Três etapas, uma única vez. Cada uma libera a próxima.
      </Text>

      <VerticalStep
        index={1}
        title="Dashboard e chaves"
        state={s1State}
        showDoneBody={s.authStatus === 'validated'}
      >
        <Text style={[styles.vp, { color: colors.muted }]}>
          1. Crie sua conta no Dashboard · 2. Crie uma aplicação · 3. Copie o Client ID e o Client Secret.
        </Text>
        <ActionButton
          primary
          icon="open-in-new"
          label="Abrir Pluggy Dashboard"
          disabled={s.authStatus === 'validating'}
          onPress={s.openDashboard}
        />

        {!!chipLabel && !lockedStep1 && (
          <TouchableOpacity
            style={[styles.cchip, { borderColor: colors.acc, backgroundColor: colors.greenBg }]}
            onPress={() => s.applySuggestion()}
            accessibilityRole="button"
            accessibilityLabel={chipLabel}
          >
            <MaterialIcons name="content-copy" size={16} color={colors.acc} />
            <Text style={[styles.cchipText, { color: colors.ink }]} numberOfLines={1}>
              {chipLabel}
            </Text>
          </TouchableOpacity>
        )}

        <KeyPasteField
          label="Client ID"
          value={s.clientId}
          onChangeText={(v) => s.updateField('id', v)}
          onPaste={() => s.paste('id')}
          locked={lockedStep1}
          invalid={fieldInvalid}
        />
        <KeyPasteField
          label="Client Secret"
          secret
          value={s.clientSecret}
          onChangeText={(v) => s.updateField('secret', v)}
          onPaste={() => s.paste('secret')}
          locked={lockedStep1}
          invalid={fieldInvalid}
        />

        {s.authStatus === 'validating' && (
          <StatusBanner
            kind="loading"
            title="Validando com a Pluggy…"
            subtitle="POST api.pluggy.ai/auth · direto do celular"
          />
        )}
        {s.authStatus === 'validated' && (
          <StatusBanner
            kind="ok"
            title="Chaves validadas!"
            subtitle={`${s.validationNote}Guardadas no cofre do celular. Backup cifrado no seu servidor.`}
          />
        )}
        {(s.authStatus === 'error' || s.authStatus === 'offline') && (
          <StatusBanner
            kind="bad"
            title={s.authStatus === 'offline' ? 'Sem conexão' : 'Chaves inválidas'}
            subtitle={s.error}
          />
        )}

        {!s.validated && s.authStatus !== 'validating' && (
          <ActionButton
            label="Validar chaves"
            busy={s.busy}
            disabled={!canValidate(s.clientId, s.clientSecret)}
            onPress={() => void s.validateKeys()}
          />
        )}
      </VerticalStep>

      <VerticalStep index={2} title="Meu Pluggy e bancos" state={s2State}>
        <Text style={[styles.vp, { color: colors.muted }]}>
          Agora abra o Meu Pluggy, crie sua conta de usuário e conecte seus bancos (Nubank, Itaú, Inter…). O app do seu
          banco abrirá automaticamente para confirmar.
        </Text>
        <ActionButton primary icon="open-in-new" label="Abrir Meu Pluggy" onPress={s.openMeuPluggy} />
        <ActionButton
          label="Já conectei meus bancos, continuar"
          busy={s.busy && s.step2Status === 'loading'}
          onPress={s.confirmBanks}
        />
        {s.step2Status === 'loading' && (
          <StatusBanner kind="loading" title="Conferindo seus bancos…" subtitle="GET api.pluggy.ai/items" />
        )}
        {s.step2Status === 'zero' && (
          <StatusBanner
            kind="bad"
            title="Nenhum banco encontrado"
            subtitle="Abra o Meu Pluggy, conecte ao menos um banco e volte aqui."
          />
        )}
        {s.step2Status === 'found' && (
          <StatusBanner
            kind="ok"
            title={`${s.foundBanks.length} ${s.foundBanks.length > 1 ? 'bancos encontrados' : 'banco encontrado'}`}
            subtitle={s.foundBanks.join(' · ')}
          />
        )}
        {s.step2Status === 'error' && <ErrorText message={s.error} />}
      </VerticalStep>

      <VerticalStep index={3} title="Sincronizar" state={s3State} isLast>
        <Text style={[styles.vp, { color: colors.muted }]}>
          O Vito usa as suas chaves para abrir o Pluggy Connect e trazer os bancos. Tudo sai do celular, o servidor nunca
          fala com a Pluggy.
        </Text>
        {s.step === '3' && <ErrorText message={s.error} />}
        <ActionButton primary label="Sincronizar no Vito" busy={s.busy} onPress={s.syncNow} />
      </VerticalStep>

      <TouchableOpacity onPress={s.showTutorial} style={styles.tutorialLink} accessibilityRole="button">
        <Text style={[styles.tutorialLinkText, { color: colors.muted }]}>Ver tutorial</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 28,
    lineHeight: 33,
    fontFamily: tokens.typography.family.montserratBold,
    letterSpacing: -0.6,
    marginTop: 18,
  },
  sub: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  vp: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  cchip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  cchipText: { flex: 1, fontSize: 13, fontWeight: '600' },
  tutorialLink: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  tutorialLinkText: { fontSize: 14, fontWeight: '600' },
});
