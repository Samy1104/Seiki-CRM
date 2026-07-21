import React from 'react';
import { Award } from 'lucide-react';
import { CRITERIA } from '../../hooks/useAddLeadForm';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';

interface LeadScoringSectionProps {
  scores: Record<string, { value: number; label: string }>;
  onScoreChange: (criterionId: string, value: number, label: string) => void;
  totalScore: number;
  recommendation: { text: string; className: string };
}

const scoreClass = (value: number, max: number) => {
  if (value <= 0) return 'text-ink-faint';
  if (value >= max * 0.8) return 'text-success';
  if (value >= max * 0.5) return 'text-amber';
  return 'text-danger';
};

export const LeadScoringSection: React.FC<LeadScoringSectionProps> = ({
  scores,
  onScoreChange,
  totalScore,
  recommendation,
}) => {
  return (
    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
        <Award size={14} className="text-amber" />
        Scoring ICP — 6 critères
      </div>

      <div className="flex flex-col gap-2.5">
        {CRITERIA.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5">
            <span className="w-32 flex-shrink-0 text-xs font-medium text-ink-soft">{c.label}</span>
            <span className="w-8 flex-shrink-0 text-[10px] text-ink-faint">/{c.max}</span>
            <Select
              value={String(scores[c.id].value)}
              onValueChange={(valStr) => {
                const val = parseInt(valStr) || 0;
                const opt = c.opts.find((o) => o.v === val);
                onScoreChange(c.id, val, opt ? opt.l : '');
              }}
            >
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue placeholder="— Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">— Sélectionner</SelectItem>
                {c.opts.map((o) => (
                  <SelectItem key={o.v} value={String(o.v)}>
                    {o.l} ({o.v}pts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className={`w-12 flex-shrink-0 text-right text-xs font-semibold tabular-nums ${scoreClass(scores[c.id].value, c.max)}`}>
              {scores[c.id].value > 0 ? `${scores[c.id].value}pts` : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-0.5 text-[11px] text-ink-faint">Score ICP</div>
            <div className={`font-display text-3xl font-bold tabular-nums ${scoreClass(totalScore, 100)}`}>
              {totalScore}
            </div>
          </div>
          <div className="text-[11px] text-ink-faint">/100 pts</div>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-hover">
          <div
            className={`h-full transition-all ${totalScore >= 80 ? 'bg-success' : totalScore >= 60 ? 'bg-amber' : totalScore > 0 ? 'bg-danger' : 'bg-transparent'}`}
            style={{ width: `${totalScore}%` }}
          />
        </div>

        <div className={`mt-3 text-xs font-medium ${recommendation.className}`}>
          {recommendation.text}
        </div>
      </div>
    </div>
  );
};
