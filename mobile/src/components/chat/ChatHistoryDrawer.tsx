import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConversationSession } from '../../types';
import {
  filterSessionsByQuery,
  findEmptyOrErrorSessions,
  groupSessionsByDate,
} from '../../utils/chatHistoryGrouping';
import { useTheme } from '../../context/ThemeContext';
import { SwipeableConversationRow } from './SwipeableConversationRow';

interface ChatHistoryDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
  conversations: ConversationSession[];
  onSelectConversation: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  pendingCount?: number;
  onRetrySync?: () => void;
}

const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 340);

/**
 * Gaveta lateral de conversas fiel ao protótipo `<aside class="drawer" id="drawer">`
 * de `vito-telas.html`, com busca em tempo real, sugestão inteligente de limpeza
 * e gesto de deslizar para fixar ou excluir.
 */
export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  visible,
  onClose,
  onNewChat,
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onTogglePin,
  pendingCount,
  onRetrySync,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [searchQuery, setSearchQuery] = useState('');
  const [cleanupDismissed, setCleanupDismissed] = useState(false);
  const [rowSwiping, setRowSwiping] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 340,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slide.setValue(-PANEL_WIDTH);
      backdropOpacity.setValue(0);
    }
  }, [visible, slide, backdropOpacity]);

  const filteredConversations = useMemo(
    () => filterSessionsByQuery(conversations, searchQuery),
    [conversations, searchQuery],
  );

  const pinnedConversations = useMemo(
    () => filteredConversations.filter((c) => c.pinned),
    [filteredConversations],
  );
  const unpinnedConversations = useMemo(
    () => filteredConversations.filter((c) => !c.pinned),
    [filteredConversations],
  );
  const unpinnedGroups = useMemo(
    () => groupSessionsByDate(unpinnedConversations),
    [unpinnedConversations],
  );

  const emptyOrErrorSessions = useMemo(
    () => findEmptyOrErrorSessions(conversations),
    [conversations],
  );

  const showCleanupBanner =
    !cleanupDismissed &&
    !!onDeleteConversation &&
    emptyOrErrorSessions.length > 0 &&
    conversations.length > emptyOrErrorSessions.length;

  const showPending = (pendingCount ?? 0) > 0;
  const canDeleteRow = !!onDeleteConversation && conversations.length > 1;

  const handleCleanEmptyConversations = () => {
    if (!onDeleteConversation) return;
    emptyOrErrorSessions.forEach((session) => {
      onDeleteConversation(session.id);
    });
    setCleanupDismissed(true);
  };

  if (!visible) return null;

  const topPad =
    Platform.OS === 'android'
      ? Math.max((RNStatusBar.currentHeight || 0) + 12, 36)
      : Math.max(insets.top + 8, 36);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
            accessibilityLabel="Fechar histórico"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              width: PANEL_WIDTH,
              backgroundColor: colors.bg,
              paddingTop: topPad,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateX: slide }],
            },
          ]}
        >
          {/* Cabeçalho .drawer h2 + .sub */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text style={[styles.headerTitle, { color: colors.ink }]}>Conversas</Text>
              <Text style={[styles.headerSub, { color: colors.muted }]}>
                {conversations.length} {conversations.length === 1 ? 'conversa' : 'conversas'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surf }]}
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityLabel="Fechar conversas"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Busca .dsearch */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: colors.surf,
                borderColor: colors.line,
              },
            ]}
          >
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar conversas"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.ink }]}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Buscar conversas"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Limpar busca"
                accessibilityRole="button"
              >
                <MaterialIcons name="close" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Alerta de sincronização pendente (se houver) */}
          {showPending && (
            <View
              style={[
                styles.suggestionCard,
                { backgroundColor: colors.surf, borderColor: colors.line },
              ]}
              accessibilityRole="alert"
            >
              <View style={styles.suggestionBody}>
                <Text style={[styles.suggestionText, { color: colors.ink }]}>
                  Sincronização pendente ({pendingCount})
                </Text>
                {onRetrySync && (
                  <View style={styles.suggestionActions}>
                    <TouchableOpacity
                      style={[
                        styles.suggestionBtnPrimary,
                        { backgroundColor: colors.ink, borderColor: colors.ink },
                      ]}
                      onPress={onRetrySync}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityLabel="Reenviar sincronização pendente"
                    >
                      <Text style={[styles.suggestionBtnPrimaryText, { color: colors.bg }]}>
                        Reenviar
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Sugestão inteligente .vsug#dclean de vito-telas.html */}
          {showCleanupBanner && (
            <View
              style={[
                styles.suggestionCard,
                { backgroundColor: colors.surf, borderColor: colors.line },
              ]}
            >
              <View style={[styles.vitoBadge, { backgroundColor: colors.ink }]}>
                <Text style={[styles.vitoBadgeText, { color: colors.bg }]}>v</Text>
              </View>
              <View style={styles.suggestionBody}>
                <Text style={[styles.suggestionText, { color: colors.ink }]}>
                  <Text style={styles.suggestionBold}>
                    {emptyOrErrorSessions.length}{' '}
                    {emptyOrErrorSessions.length === 1
                      ? 'conversa vazia ou com erro.'
                      : 'conversas vazias ou com erro.'}
                  </Text>{' '}
                  Quer que eu limpe?
                </Text>
                <View style={styles.suggestionActions}>
                  <TouchableOpacity
                    style={[
                      styles.suggestionBtnPrimary,
                      { backgroundColor: colors.ink, borderColor: colors.ink },
                    ]}
                    onPress={handleCleanEmptyConversations}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar conversas vazias"
                  >
                    <Text style={[styles.suggestionBtnPrimaryText, { color: colors.bg }]}>
                      Limpar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.suggestionBtnSecondary, { borderColor: colors.line }]}
                    onPress={() => setCleanupDismissed(true)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Agora não"
                  >
                    <Text style={[styles.suggestionBtnSecondaryText, { color: colors.ink }]}>
                      Agora não
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Lista .cvl */}
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!rowSwiping}
          >
            {filteredConversations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyTitle, { color: colors.ink }]}>
                  {searchQuery.trim()
                    ? 'Nenhuma conversa encontrada'
                    : 'Você ainda não tem conversas'}
                </Text>
                <Text style={[styles.emptySub, { color: colors.muted }]}>
                  {searchQuery.trim()
                    ? 'Tente buscar por outro termo ou assunto.'
                    : 'Suas trocas de mensagens com o Vito aparecerão listadas aqui.'}
                </Text>
              </View>
            ) : (
              <>
                {pinnedConversations.length > 0 && (
                  <View>
                    <Text
                      style={[styles.groupHeader, { color: colors.muted }]}
                      accessibilityRole="header"
                    >
                      Fixadas
                    </Text>
                    {pinnedConversations.map((conv) => (
                      <SwipeableConversationRow
                        key={conv.id}
                        conversation={conv}
                        canDelete={canDeleteRow}
                        onSelect={(id) => {
                          onSelectConversation(id);
                          onClose();
                        }}
                        onTogglePin={onTogglePin}
                        onDelete={onDeleteConversation}
                        onSwipeStateChange={setRowSwiping}
                      />
                    ))}
                  </View>
                )}

                {unpinnedGroups.map((group) => (
                  <View key={group.key}>
                    <Text
                      style={[styles.groupHeader, { color: colors.muted }]}
                      accessibilityRole="header"
                    >
                      {group.title}
                    </Text>
                    {group.sessions.map((conv) => (
                      <SwipeableConversationRow
                        key={conv.id}
                        conversation={conv}
                        canDelete={canDeleteRow}
                        onSelect={(id) => {
                          onSelectConversation(id);
                          onClose();
                        }}
                        onTogglePin={onTogglePin}
                        onDelete={onDeleteConversation}
                        onSwipeStateChange={setRowSwiping}
                      />
                    ))}
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          {/* Rodapé .dhint + .cta2 */}
          <Text style={[styles.swipeHint, { color: colors.muted }]}>
            Deslize para fixar ou excluir
          </Text>

          <TouchableOpacity
            style={[styles.newChatBtn, { backgroundColor: colors.ink }]}
            onPress={() => {
              onClose();
              onNewChat();
            }}
            activeOpacity={0.86}
            accessibilityLabel="Iniciar nova conversa"
            accessibilityRole="button"
          >
            <Text style={[styles.newChatBtnText, { color: colors.bg }]}>+ Nova conversa</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 13, 18, 0.35)',
  },
  panel: {
    height: '100%',
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    overflow: 'hidden',
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.48,
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    marginTop: 12,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    paddingVertical: 0,
  },
  suggestionCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  vitoBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  vitoBadgeText: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 12,
    fontWeight: '800',
  },
  suggestionBody: {
    flex: 1,
    minWidth: 0,
  },
  suggestionText: {
    fontSize: 13,
    lineHeight: 17.5,
  },
  suggestionBold: {
    fontWeight: '600',
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  suggestionBtnPrimary: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionBtnSecondary: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listScroll: {
    flex: 1,
    marginTop: 10,
  },
  listContent: {
    paddingBottom: 12,
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 6,
    marginHorizontal: 4,
  },
  emptyContainer: {
    paddingVertical: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 12,
    marginVertical: 8,
  },
  newChatBtn: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  newChatBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
