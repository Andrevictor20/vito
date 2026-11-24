import React from 'react';
import { CheckCircle2, Calendar, Bot, Bell } from 'lucide-react';
import { BotMascotRig } from '../bots/BotMascotRig';
import type {
  InboxNotification,
  InboxNotificationAction,
} from '../../services/api/notifications/inboxNotificationsApi';

interface NotificationItemCardProps {
  item: InboxNotification;
  busy?: boolean;
  onAction: (item: InboxNotification, action: InboxNotificationAction) => void;
}

function DomainIcon({ domain }: { domain: string }) {
  if (domain === 'tasks') return <CheckCircle2 size={18} />;
  if (domain === 'booking' || domain === 'calendar') return <Calendar size={18} />;
  if (domain === 'bots') return <Bot size={18} />;
  return <Bell size={18} />;
}

export const NotificationItemCard: React.FC<NotificationItemCardProps> = ({
  item,
  busy = false,
  onAction,
}) => {
  const isBot = Boolean(item.bot_id || item.source_domain === 'bots');
  let parsedSkin = undefined;
  if (item.bot_skin_json) {
    try {
      parsedSkin = JSON.parse(item.bot_skin_json);
    } catch {
      parsedSkin = undefined;
    }
  }

  return (
    <div className="relative rounded-[20px] bg-[var(--surf)] border border-[var(--line)] p-3.5 transition-all">
      {item.is_unread && (
        <span
          className="absolute top-4 right-3.5 w-2 h-2 rounded-full bg-[var(--ink)]"
          title="Não lida"
        />
      )}

      <div className="flex items-start gap-3">
        {isBot ? (
          <div className="w-10 h-10 rounded-[13px] bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center shrink-0">
            <BotMascotRig size={32} skin={parsedSkin} state="idle" animated={false} />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-[13px] bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center shrink-0 text-[var(--ink)]">
            <DomainIcon domain={item.source_domain} />
          </div>
        )}

        <div className="flex-1 min-w-0 pr-4">
          <b className="block text-[14.5px] font-semibold text-[var(--ink)] leading-snug">
            {item.title}
          </b>
          <p className="text-[13px] text-[var(--muted)] mt-0.5 leading-relaxed">
            {item.body}
          </p>
          <span className="inline-block text-[11.5px] text-[var(--muted)] mt-1 tabular-nums">
            {item.time_label}
          </span>
        </div>
      </div>

      {item.actions && item.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pl-[52px]">
          {item.actions.map((act) => (
            <button
              key={`${item.id}-${act.action}`}
              type="button"
              disabled={busy}
              onClick={() => onAction(item, act)}
              className={`h-9 px-3.5 rounded-full text-[12.5px] font-semibold transition-transform active:scale-95 ${
                act.primary
                  ? 'bg-[var(--ink)] text-[var(--bg)]'
                  : 'bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              {act.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
