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
      : 'border-l-[#c8b89a]/50';

  return (
    <motion.div
      onClick={() => onOpen(lead.id)}
      whileHover={{ y: -1.5 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className={`cursor-pointer rounded-control border border-line-strong border-l-[3px] bg-elevated px-2.5 py-2 hover:border-[#c8b89a] hover:shadow-hover transition-all ${borderClass}`}
    >
      {/* Line 1: Company Name & Deal Value */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-bold text-ink" title={lead.company_name}>
          {lead.company_name}
        </span>
        <span className="font-display text-[12px] font-bold text-ink whitespace-nowrap">
          {lead.deal_value?.toLocaleString()} €
        </span>
      </div>

      {/* Line 2: Segment & Metrics */}
      <div className="mt-1.5 flex items-center justify-between gap-1.5 text-[10.5px]">
        <Badge tone="neutral" className="px-1.5 py-0 text-[9.5px] font-semibold">{lead.segment}</Badge>
        <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
          <span className={`text-[10px] ${slaBreached ? 'font-semibold text-danger' : 'text-ink-faint'}`}>
            J+{lead.days_in_stage}
          </span>
          <span className={`font-bold ${scoreColorClass(lead.score)}`}>{lead.score}</span>
        </div>
      </div>
    </motion.div>
  );
};
