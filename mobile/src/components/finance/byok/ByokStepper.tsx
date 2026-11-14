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

/** Card de passo didático numerado para o onboarding manual e no navegador externo. */
const GuideStepRow: React.FC<{
  num: number;
  title: string;
  desc: string;
  isLast?: boolean;
}> = ({ num, title, desc, isLast }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.guideRow, isLast && { marginBottom: 0 }]}>
      <View style={[styles.guideNumBadge, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        <Text style={[styles.guideNumText, { color: colors.ink }]}>{num}</Text>
      </View>
      <View style={styles.guideTextCol}>
        <Text style={[styles.guideTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.guideDesc, { color: colors.muted }]}>{desc}</Text>
      </View>
    </View>
  );
};

/** Stepper vertical didático e visual para o fluxo BYOK com navegador externo. */
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
        Três etapas simples e seguras com suas credenciais privadas da Pluggy.
      </Text>

      {/* ETAPA 1: Dashboard e chaves */}
      <VerticalStep
        index={1}
        title="Dashboard e chaves"
        state={s1State}
        showDoneBody={s.authStatus === 'validated'}
      >
        <View style={[styles.guideBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <Text style={[styles.guideBoxHeading, { color: colors.ink }]}>Como obter suas chaves na Pluggy:</Text>
          <GuideStepRow
            num={1}
            title="Abra o Dashboard"
            desc="Toque no botão abaixo para abrir a Pluggy no seu navegador. Entre na sua conta (Google ou e-mail)."
          />
          <GuideStepRow
            num={2}
            title="Acesse Aplicações"
            desc="No menu da Pluggy, clique em Aplicações (ou use a tela inicial do Dashboard)."
          />
          <GuideStepRow
            num={3}
            title="Copie as credenciais"
            desc="Copie o Client ID e o Client Secret. Se o segredo estiver oculto, clique em 'Gerar novo secret'."
          />
          <GuideStepRow
            num={4}
            title="Cole e valide no Vito"
            desc="Volte aqui no Vito, cole nos campos abaixo e valide com um toque."
            isLast
          />
        </View>

        <ActionButton
          primary
          icon="open-in-new"
          label="Abrir Pluggy Dashboard no Navegador"
          disabled={s.authStatus === 'validating'}
          onPress={s.openDashboardExternal}
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
            subtitle={`${s.validationNote}Guardadas com segurança no cofre do aparelho. Backup cifrado no seu servidor.`}
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

      {/* ETAPA 2: Pluggy Connect e bancos */}
      <VerticalStep index={2} title="Pluggy Connect e bancos" state={s2State}>
        <View style={[styles.guideBox, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <Text style={[styles.guideBoxHeading, { color: colors.ink }]}>Como conectar seus bancos com segurança:</Text>
          <GuideStepRow
            num={1}
            title="Abrir o Pluggy Connect"
            desc="Toque no botão abaixo. O widget oficial da Pluggy será aberto de forma segura no seu navegador."
          />
          <GuideStepRow
            num={2}
            title="Autorizar Meu Pluggy ou Bancos"
            desc="Autorize o conector Meu Pluggy (para contas já agrupadas) ou conecte diretamente seus bancos (Nubank, Itaú, Inter, etc.)."
          />
          <GuideStepRow
            num={3}
            title="Concluir e sincronizar"
            desc="Ao autorizar no app do seu banco, o navegador redireciona de volta ao Vito. Se voltar manualmente, use o botão de sincronização abaixo."
            isLast
          />
        </View>

        <ActionButton
          primary
          icon="open-in-new"
          label="Abrir Pluggy Connect no Navegador"
          busy={s.busy}
          onPress={s.openConnectExternal}
        />

        <ActionButton
          icon="sync"
          label="Já conectei meus bancos · Sincronizar contas"
          busy={s.busy}
          style={{ marginTop: 10 }}
          onPress={() => void s.completeConnectSync('')}
        />

        {s.error ? <ErrorText message={s.error} /> : null}
      </VerticalStep>

      {/* ETAPA 3: Sincronizar */}
      <VerticalStep index={3} title="Sincronizar" state={s3State} isLast>
        <Text style={[styles.vp, { color: colors.muted }]}>
          O Vito usa suas credenciais privadas para ler contas e transações da Pluggy diretamente no smartphone (Edge-Sync). O servidor nunca recebe suas senhas bancárias.
        </Text>
        {s.step === '3' && <ErrorText message={s.error} />}
        <ActionButton primary icon="sync" label="Sincronizar contas agora" busy={s.busy} onPress={() => void s.completeConnectSync('')} />
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
  sub: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 },
  vp: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  guideBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  guideBoxHeading: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 12,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  guideNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  guideNumText: {
    fontSize: 12,
    fontWeight: '700',
  },
  guideTextCol: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  guideDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
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
