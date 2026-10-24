import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { ConversationSession } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { humanizePreview } from '../../utils/chatPreview';
import {
  formatDrawerRowTime,
  resolveSwipeAction,
  SWIPE_ACTION_THRESHOLD_PX,
} from '../../utils/chatHistoryGrouping';

interface SwipeableConversationRowProps {
  conversation: ConversationSession;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSwipeStateChange?: (swiping: boolean) => void;
}

const SNAP_OPEN_OFFSET = 82;
const SNAP_REVEAL_MIN = 28;
const MAX_DRAG_OFFSET = 128;

export const SwipeableConversationRow: React.FC<SwipeableConversationRowProps> = ({
  conversation,
  canDelete,
  onSelect,
  onTogglePin,
  onDelete,
  onSwipeStateChange,
}) => {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const openSideRef = useRef<'none' | 'left' | 'right'>('none');
  const [revealedSide, setRevealedSide] = useState<'none' | 'left' | 'right'>('none');

  const animateTo = (toValue: number, nextSide: 'none' | 'left' | 'right' = 'none') => {
    openSideRef.current = nextSide;
    setRevealedSide(nextSide);
    Animated.spring(translateX, {
      toValue,
      damping: 22,
      stiffness: 240,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  };

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(12);
      } catch {
        // Ignora caso permissão de vibração não esteja disponível
      }
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => {
          const absDx = Math.abs(g.dx);
          const absDy = Math.abs(g.dy);
          return absDx > 8 && absDx > absDy * 1.25;
        },
        onPanResponderGrant: () => {
          onSwipeStateChange?.(true);
        },
        onPanResponderMove: (_, g) => {
          const baseOffset =
            openSideRef.current === 'left'
              ? SNAP_OPEN_OFFSET
              : openSideRef.current === 'right'
                ? -SNAP_OPEN_OFFSET
                : 0;
          let nextDx = baseOffset + g.dx;
          if (!onTogglePin && nextDx > 0) nextDx = 0;
          if ((!canDelete || !onDelete) && nextDx < 0) nextDx = 0;
          const clamped = Math.max(-MAX_DRAG_OFFSET, Math.min(MAX_DRAG_OFFSET, nextDx));
          if (clamped > 4 && revealedSide !== 'left') setRevealedSide('left');
          else if (clamped < -4 && revealedSide !== 'right') setRevealedSide('right');
          translateX.setValue(clamped);
        },
        onPanResponderRelease: (_, g) => {
          onSwipeStateChange?.(false);
          const baseOffset =
            openSideRef.current === 'left'
              ? SNAP_OPEN_OFFSET
              : openSideRef.current === 'right'
                ? -SNAP_OPEN_OFFSET
                : 0;
          const totalDx = baseOffset + g.dx;
          const action = resolveSwipeAction(totalDx);

          if (action === 'pin' && onTogglePin) {
            triggerHaptic();
            animateTo(0, 'none');
            onTogglePin(conversation.id);
            return;
          }

          if (action === 'delete' && canDelete && onDelete) {
            triggerHaptic();
            animateTo(0, 'none');
            onDelete(conversation.id);
            return;
          }

          if (totalDx >= SNAP_REVEAL_MIN && onTogglePin) {
            animateTo(SNAP_OPEN_OFFSET, 'left');
            return;
          }

          if (totalDx <= -SNAP_REVEAL_MIN && canDelete && onDelete) {
            animateTo(-SNAP_OPEN_OFFSET, 'right');
            return;
          }

          animateTo(0, 'none');
        },
        onPanResponderTerminate: () => {
          onSwipeStateChange?.(false);
          animateTo(0, 'none');
        },
      }),
    [canDelete, conversation.id, onDelete, onSwipeStateChange, onTogglePin, revealedSide, translateX],
  );

  const isActive = !!conversation.active;
  const timeLabel = formatDrawerRowTime(conversation.timestamp);
  const previewText = humanizePreview(conversation.preview) || 'Nova conversa';

  const handleRowPress = () => {
    if (openSideRef.current !== 'none') {
      animateTo(0, 'none');
      return;
    }
    onSelect(conversation.id);
  };

  return (
    <View style={styles.container}>
      {/* Background de ações reveladas no swipe */}
      <View style={styles.actionsBackdrop} pointerEvents="box-none">
        {onTogglePin && (
          <TouchableOpacity
            style={[
              styles.leftAction,
              {
                backgroundColor: colors.blueBg,
                opacity: revealedSide === 'left' ? 1 : 0,
              },
            ]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic();
              animateTo(0, 'none');
              onTogglePin(conversation.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={conversation.pinned ? 'Desfixar conversa' : 'Fixar conversa'}
          >
            <MaterialIcons
              name={conversation.pinned ? 'push-pin' : 'bookmark-outline'}
              size={16}
              color={colors.blue}
            />
            <Text style={[styles.actionLabel, { color: colors.blue }]}>
              {conversation.pinned ? 'Desfixar' : 'Fixar'}
            </Text>
          </TouchableOpacity>
        )}

        {canDelete && onDelete && (
          <TouchableOpacity
            style={[
              styles.rightAction,
              {
                backgroundColor: colors.redBg,
                opacity: revealedSide === 'right' ? 1 : 0,
              },
            ]}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic();
              animateTo(0, 'none');
              onDelete(conversation.id);
            }}
            accessibilityRole="button"
            accessibilityLabel="Excluir conversa"
          >
            <MaterialIcons name="delete-outline" size={16} color={colors.red} />
            <Text style={[styles.actionLabel, { color: colors.red }]}>Excluir</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Linha deslizável (.cvr em vito-telas.html) */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[
            styles.row,
            {
              backgroundColor: isActive ? colors.surf : colors.bg,
            },
          ]}
          activeOpacity={0.82}
          onPress={handleRowPress}
          accessibilityRole="button"
          accessibilityLabel={`Abrir conversa ${conversation.title || 'Conversa'}`}
        >
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isActive ? colors.ink : colors.surf,
              },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 1-2z"
                stroke={isActive ? colors.bg : colors.ink}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.textCol}>
            <Text
              style={[styles.title, { color: colors.ink }]}
              numberOfLines={1}
            >
              {conversation.title || 'Conversa'}
            </Text>
            <Text
              style={[styles.preview, { color: colors.muted }]}
              numberOfLines={1}
            >
              {previewText}
            </Text>
          </View>

          <View style={styles.metaCol}>
            {conversation.pinned && (
              <MaterialIcons
                name="bookmark"
                size={12}
                color={colors.muted}
                style={styles.pinBadge}
              />
            )}
            <Text style={[styles.time, { color: colors.muted }]}>{timeLabel}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export { SWIPE_ACTION_THRESHOLD_PX };

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 2,
  },
  actionsBackdrop: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
  },
  leftAction: {
    height: '100%',
    minWidth: SNAP_OPEN_OFFSET,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
    borderRadius: 14,
  },
  rightAction: {
    height: '100%',
    minWidth: SNAP_OPEN_OFFSET,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    borderRadius: 14,
    marginLeft: 'auto',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  preview: {
    fontSize: 12.5,
    marginTop: 2,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  pinBadge: {
    marginTop: 1,
  },
  time: {
    fontSize: 11.5,
  },
});
