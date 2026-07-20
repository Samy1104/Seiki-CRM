import React from 'react';
import { motion } from 'motion/react';
import type { Lead } from '../../services/leadsService';
import { Badge } from '../../components/ui/Badge';

export interface DealCardProps {
  lead: Lead;
  slaBreached: boolean;
  isTaskOverdue: boolean;
  onOpen: (leadId: string) => void;
}

const scoreColorClass = (score: number) => {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-amber';
  return 'text-danger';
};

export const DealCard: React.FC<DealCardProps> = ({ lead, slaBreached, isTaskOverdue, onOpen }) => {
  const borderClass = slaBreached
    ? 'border-l-danger'
    : isTaskOverdue
      ? 'border-l-amber'
      : 'border-l-line-strong';

  return (
    <motion.div
      layout
      layoutId={lead.id}
      onClick={() => onOpen(lead.id)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`cursor-pointer rounded-surface border border-[#c8b89a]/40 border-l-[3px] bg-[#141414] p-3 hover:border-[#c8b89a] hover:shadow-hover ${borderClass}`}
    >
      <div className="flex items-start justify-between text-[12.5px] font-bold text-ink">
        <span>{lead.company_name}</span>
        <span className={scoreColorClass(lead.score)}>{lead.score}</span>
      </div>

      <div className="mt-1 truncate text-[11px] text-ink-soft">{lead.contact_name || '—'}</div>
      <div className="mt-0.5 font-display text-[13px] font-semibold text-ink">{lead.deal_value}k€</div>

      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
        <Badge tone="neutral">{lead.segment}</Badge>
        <span className={`text-[10px] font-semibold ${slaBreached ? 'text-danger' : 'text-ink-faint'}`}>
          J+{lead.days_in_stage}
        </span>
      </div>
    </motion.div>
  );
};
