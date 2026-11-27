import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VitoSwitch } from '../../../components/ui/VitoSwitch';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { VitoMascot } from '../../../components/common/VitoMascot';
import type { NotificationCategoryPreferences } from '../../notifications/services/notificationsApi';
import { FAQ_ITEMS, NOTIFICATION_CATEGORY_ROWS } from '../data/storeCatalogData';

interface StoreNotifViewProps {
  prefs: NotificationCategoryPreferences;
  systemNotifAllowed: boolean;
  onTogglePref: (k: keyof NotificationCategoryPreferences) => void;
}

export const StoreNotifView: React.FC<StoreNotifViewProps> = ({
  prefs,
  systemNotifAllowed,
  onTogglePref,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {NOTIFICATION_CATEGORY_ROWS.map((r, idx) => (
          <View
            key={r.key}
            style={[
              styles.row,
              idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
            ]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{r.label}</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>{r.desc}</Text>
            </View>
            <VitoSwitch
              value={!!prefs[r.key]}
              onValueChange={() => onTogglePref(r.key)}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.fine, { color: colors.muted }]}>
        {systemNotifAllowed
          ? 'Notificações permitidas neste aparelho.'
          : 'Notificações desativadas nos ajustes do sistema.'}
      </Text>
    </View>
  );
};

interface StoreHelpViewProps {
  onOpenContact: () => void;
  onOpenReport: () => void;
  onOpenRate: () => void;
}

export const StoreHelpView: React.FC<StoreHelpViewProps> = ({
  onOpenContact,
  onOpenReport,
  onOpenRate,
}) => {
  const { colors } = useTheme();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <View style={styles.section}>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {[
          { icon: 'mail-outline' as const, title: 'Falar com o suporte', sub: 'suporte@vito.app', onPress: onOpenContact },
          { icon: 'flag' as const, title: 'Denunciar resposta da IA', sub: 'Conteúdo incorreto ou inadequado', onPress: onOpenReport },
          { icon: 'star-outline' as const, title: 'Avaliar o Vito', sub: 'Deixe uma nota de 1 a 5 estrelas', onPress: onOpenRate },
        ].map((r, idx) => (
          <TouchableOpacity
            key={r.title}
            style={[
              styles.row,
              idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
            ]}
            onPress={r.onPress}
          >
            <ProtoUiIcon name={r.icon} size={20} color={colors.ink} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{r.title}</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>{r.sub}</Text>
            </View>
            <ProtoUiIcon name="chevron-right" size={20} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.lbl, { color: colors.muted }]}>Perguntas frequentes</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {FAQ_ITEMS.map((item, idx) => {
          const open = openFaq === idx;
          return (
            <View
              key={item.q}
              style={idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line } : undefined}
            >
              <TouchableOpacity
                style={styles.row}
                onPress={() => setOpenFaq(open ? null : idx)}
              >
                <Text style={[styles.faqQ, { color: colors.ink }]}>{item.q}</Text>
                <ProtoUiIcon
                  name={open ? 'keyboard-arrow-down' : 'chevron-right'}
                  size={20}
                  color={colors.muted}
                />
              </TouchableOpacity>
              {open && (
                <Text style={[styles.faqA, { color: colors.muted }]}>{item.a}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

interface StoreAboutViewProps {
  appVersion: string;
  onOpenDoc: (doc: 'terms' | 'priv' | 'oss') => void;
}

export const StoreAboutView: React.FC<StoreAboutViewProps> = ({ appVersion, onOpenDoc }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <VitoMascot size={46} state="idle" />
        </View>
        <Text style={[styles.heroTitle, { color: colors.ink }]}>Vito</Text>
        <Text style={[styles.heroSub, { color: colors.muted }]}>
          Seu assistente pessoal com IA.{'\n'}© 2026 Vito Tecnologia Ltda.
        </Text>
      </View>

      <Text style={[styles.lbl, { color: colors.muted }]}>Informações</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {[
          { icon: 'description' as const, title: 'Termos de Uso', onPress: () => onOpenDoc('terms') },
          { icon: 'privacy-tip' as const, title: 'Política de Privacidade', onPress: () => onOpenDoc('priv') },
          { icon: 'code' as const, title: 'Licenças de código aberto', onPress: () => onOpenDoc('oss') },
        ].map((r, idx) => (
          <TouchableOpacity
            key={r.title}
            style={[
              styles.row,
              idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
            ]}
            onPress={r.onPress}
          >
            <ProtoUiIcon name={r.icon} size={20} color={colors.ink} />
            <Text style={[styles.rowTitle, { color: colors.ink, flex: 1 }]}>{r.title}</Text>
            <ProtoUiIcon name="chevron-right" size={20} color={colors.muted} />
          </TouchableOpacity>
        ))}
        <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
          <ProtoUiIcon name="info-outline" size={20} color={colors.ink} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Versão</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              {appVersion} · build OTA 01a1663
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.fineCenter, { color: colors.muted }]}>
        Respostas geradas por inteligência artificial. Classificação indicativa: Livre (13+ na conta).
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: 12 },
  lbl: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 },
  lst: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 54 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 2 },
  fine: { fontSize: 12, lineHeight: 17 },
  fineCenter: { fontSize: 11.5, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  faqQ: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  faqA: { fontSize: 13.5, lineHeight: 19, paddingHorizontal: 14, paddingBottom: 14 },
  hero: { alignItems: 'center', paddingVertical: 14 },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '600', marginTop: 12 },
  heroSub: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginTop: 4 },
});
