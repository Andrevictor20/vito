import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { tokens } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { hapticFeedback } from '../../../theme/motion';
import { BotMascotAvatar } from '../../bots/components/BotMascotAvatar';
import type {
  InboxNotification,
  InboxNotificationAction,
} from '../services/inboxNotificationsApi';

interface NotificationItemCardProps {
  item: InboxNotification;
  busy?: boolean;
  onAction: (item: InboxNotification, action: InboxNotificationAction) => void;
}

function getDomainIcon(domain: string): string {
  if (domain === 'tasks') return 'check-circle-outline';
  if (domain === 'booking' || domain === 'calendar') return 'calendar-today';
  if (domain === 'bots') return 'smart-toy';
  return 'notifications-none';
}

export const NotificationItemCard: React.FC<NotificationItemCardProps> = ({
  item,
  busy = false,
  onAction,
}) => {
  const { colors, isDark } = useTheme();
  const isBot = Boolean(item.bot_id || item.source_domain === 'bots');
  const botColor = item.bot_color || colors.orange;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surf,
          borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(10,10,10,0.065)',
        },
      ]}
    >
      {item.is_unread && (
        <View
          style={[styles.unreadDot, { backgroundColor: colors.ink }]}
          accessibilityLabel="Não lida"
        />
      )}

      <View style={styles.topRow}>
        {isBot ? (
          <View
            style={[
              styles.iconBox,
              styles.botBox,
              {
                backgroundColor: colors.bg,
                borderColor: botColor,
              },
            ]}
          >
            <BotMascotAvatar
              size={34}
              skinJson={item.bot_skin_json}
              animState="idle"
              animated={false}
            />
          </View>
        ) : (
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: colors.bg,
                borderColor: colors.line,
              },
            ]}
          >
            <ProtoUiIcon
              name={getDomainIcon(item.source_domain)}
              size={19}
              color={colors.ink}
            />
          </View>
        )}

        <View style={styles.bodyCol}>
          <Text
            style={[
              styles.title,
              { color: colors.ink, fontFamily: tokens.typography.family.semibold },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text
            style={[
              styles.desc,
              { color: colors.muted, fontFamily: tokens.typography.family.regular },
            ]}
            numberOfLines={3}
          >
            {item.body}
          </Text>
          <Text
            style={[
              styles.time,
              { color: colors.muted, fontFamily: tokens.typography.family.regular },
            ]}
          >
            {item.time_label}
          </Text>
        </View>
      </View>

      {item.actions && item.actions.length > 0 && (
        <View style={styles.actionsRow}>
          {item.actions.map((act) => (
            <TouchableOpacity
              key={`${item.id}-${act.action}`}
              style={[
                styles.actBtn,
                {
                  backgroundColor: act.primary ? colors.ink : colors.bg,
                  borderColor: act.primary ? colors.ink : colors.line,
                },
              ]}
              onPress={() => {
                hapticFeedback.selection();
                onAction(item, act);
              }}
              disabled={busy}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={act.label}
            >
              <Text
                style={[
                  styles.actBtnText,
                  {
                    color: act.primary ? colors.bg : colors.ink,
                    fontFamily: tokens.typography.family.semibold,
                  },
                ]}
              >
                {act.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 14,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botBox: {
    padding: 2,
  },
  bodyCol: {
    flex: 1,
    paddingRight: 14,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  time: {
    fontSize: 11.5,
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingLeft: 52,
  },
  actBtn: {
    height: 38,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
