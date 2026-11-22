import React from 'react';
import { X } from 'lucide-react';

export const VOTER_COLORS = ['#0a7cff', '#0aa55c', '#ff2fa0', '#f08300', '#7a4fe0', '#0aa5b5'];

export function getVoterInitials(name: string): string {
  const parts = (name || 'U').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface VotersModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  voters: string[];
}

export const VotersModal: React.FC<VotersModalProps> = ({ open, onClose, title, voters }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[24px] bg-[var(--bg)] border border-[var(--line)] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">{title}</h3>
            <p className="text-xs text-[var(--muted)]">
              {voters.length} {voters.length === 1 ? 'participante votou' : 'participantes votaram'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--muted)] hover:bg-[var(--surf)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="divide-y divide-[var(--line)] max-h-80 overflow-y-auto">
          {voters.map((name, idx) => (
            <div key={`${name}-${idx}`} className="py-2.5 flex items-center gap-3">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ backgroundColor: VOTER_COLORS[idx % VOTER_COLORS.length] }}
              >
                {getVoterInitials(name)}
              </span>
              <div>
                <b className="block text-sm font-medium text-[var(--ink)]">{name}</b>
                <small className="text-xs text-[var(--muted)]">Votou neste horário</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
