import React, { useEffect, useState } from 'react';
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
import { api } from '../../../services/api';
import {
  Bot,
  BotChatMessage,
  BotPendingApproval,
  PendingResolutionDecision,
} from '../types/bots';
import { isAlwaysAskAction, resolveBotAnimState } from '../utils/botsHelpers';
import { BotMascotAvatar } from './BotMascotAvatar';

export interface BotChatTabProps {
  bot: Bot;
  onRunNow: () => Promise<void>;
  onResolvePending: (
    botId: string,
    pending: BotPendingApproval,
    decision: PendingResolutionDecision
  ) => void;
  onAcceptProposal?: (message: BotChatMessage) => Promise<void>;
  runningNow: boolean;
}

export const BotChatTab: React.FC<BotChatTabProps> = ({
  bot,
  onRunNow,
  onResolvePending,
  onAcceptProposal,
  runningNow,
}) => {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<BotChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getBotChat(bot.id)
      .then((res) => {
        if (alive) setMessages(res);
      })
      .catch(() => {
        if (alive) setMessages([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bot.id]);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? draft).trim();
    if (!text || sending) return;
    if (!textOverride) setDraft('');

    const optimistic: BotChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      const res = await api.sendBotChat(bot.id, text);
      if (Array.isArray(res.messages) && res.messages.length > 0) {
        setMessages(res.messages);
      } else if (res.reply) {
        setMessages((prev) => [...prev, res.reply!]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'system',
          content: 'Não consegui enviar sua mensagem agora. Tente novamente.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const animState = runningNow ? 'thinking' : resolveBotAnimState(bot);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero .rd-hero */}
        <View style={[styles.hero, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <BotMascotAvatar
            size={76}
            skin={bot.skin}
            skinJson={bot.skin_json}
            animState={animState}
            animated
          />
          <Text style={[styles.heroTitle, { color: colors.ink }]}>{bot.title}</Text>
          <Text style={[styles.heroGoal, { color: colors.muted }]}>{bot.goal}</Text>
        </View>

        {/* Caixas Aguardando você */}
        {(bot.pending ?? []).map((pend) => {
          const canAlwaysAllow = !isAlwaysAskAction(pend.action_key, pend.always_ask);
          return (
            <View
              key={pend.confirmation_id}
              style={[
                styles.waitBox,
                { backgroundColor: colors.orangeBg, borderColor: colors.orange },
              ]}
            >
              <Text style={[styles.waitTag, { color: colors.orange }]}>AGUARDANDO VOCÊ</Text>
              <Text style={[styles.waitTitle, { color: colors.ink }]}>{pend.title}</Text>
              <Text style={[styles.waitSummary, { color: colors.muted }]}>{pend.summary}</Text>
              <View style={styles.waitBtns}>
                <TouchableOpacity
                  style={[styles.waitBtn, { backgroundColor: colors.bg, borderColor: colors.line }]}
                  onPress={() => onResolvePending(bot.id, pend, 'deny')}
                >
                  <Text style={[styles.waitBtnText, { color: colors.red }]}>Recusar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.waitBtn, { backgroundColor: colors.ink, borderColor: colors.ink }]}
                  onPress={() => onResolvePending(bot.id, pend, 'allow_once')}
                >
                  <Text style={[styles.waitBtnText, { color: colors.bg }]}>Aprovar</Text>
                </TouchableOpacity>
                {canAlwaysAllow && (
                  <TouchableOpacity
                    style={[
                      styles.waitBtn,
                      { backgroundColor: colors.bg, borderColor: colors.line },
                    ]}
                    onPress={() => onResolvePending(bot.id, pend, 'always_allow')}
                  >
                    <Text style={[styles.waitBtnText, { color: colors.acc }]}>
                      Sempre permitir
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.ink} />
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <View
                key={msg.id}
                style={[
                  styles.bubble,
                  isUser
                    ? [styles.bubbleUser, { backgroundColor: colors.ink }]
                    : [styles.bubbleBot, { backgroundColor: colors.surf, borderColor: colors.line }],
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isUser ? colors.bg : colors.ink },
                  ]}
                >
                  {msg.content}
                </Text>
                {msg.proposal && onAcceptProposal && (
                  <TouchableOpacity
                    style={[styles.proposalBtn, { backgroundColor: colors.acc }]}
                    onPress={() => onAcceptProposal(msg)}
                  >
                    <Text style={[styles.proposalBtnText, { color: '#FFFFFF' }]}>
                      {msg.proposal.label}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Chips rápidos + input */}
      <View style={[styles.bottomBar, { borderTopColor: colors.line, backgroundColor: colors.bg }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChips}
        >
          <TouchableOpacity
            style={[styles.quickChip, { backgroundColor: colors.surf, borderColor: colors.line }]}
            onPress={onRunNow}
            disabled={runningNow}
          >
            <ProtoUiIcon name="play-arrow" size={14} color={colors.ink} />
            <Text style={[styles.quickChipText, { color: colors.ink }]}>
              {runningNow ? 'Executando...' : 'Executar agora'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickChip, { backgroundColor: colors.surf, borderColor: colors.line }]}
            onPress={() => handleSend('Quais foram suas últimas ações?')}
          >
            <ProtoUiIcon name="history" size={14} color={colors.ink} />
            <Text style={[styles.quickChipText, { color: colors.ink }]}>Últimas ações</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Fale com este bot..."
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              { backgroundColor: colors.surf, color: colors.ink, borderColor: colors.line },
            ]}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: draft.trim() ? colors.ink : colors.line },
            ]}
            onPress={() => handleSend()}
            disabled={!draft.trim() || sending}
          >
            <ProtoUiIcon name="arrow-upward" size={20} color={colors.bg} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 10,
  },
  hero: {
    alignItems: 'center',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  heroGoal: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  waitBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  waitTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  waitTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  waitSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  waitBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  waitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  waitBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loader: {
    marginVertical: 20,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  proposalBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  proposalBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 14,
    gap: 8,
  },
  quickChips: {
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
