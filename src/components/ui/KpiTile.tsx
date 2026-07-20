import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

export type KpiAccent = 'amber' | 'success' | 'danger' | 'neutral';

export interface KpiTileProps {
  label: string;
  value: number;
  sub?: string;
  accent?: KpiAccent;
  formatValue?: (v: number) => string;
  className?: string;
}

const accentBorder: Record<KpiAccent, string> = {
  amber: 'border-t-amber',
  success: 'border-t-success',
  danger: 'border-t-danger',
  neutral: 'border-t-line-strong',
};

const defaultFormat = (v: number) => Math.round(v).toLocaleString('fr-FR');

export const KpiTile: React.FC<KpiTileProps> = ({
  label,
  value,
  sub,
  accent = 'neutral',
  formatValue = defaultFormat,
  className = '',
}) => {
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => formatValue(v));

  useEffect(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const controls = animate(motionValue, value, {
      duration: prefersReducedMotion ? 0 : 0.6,
      ease: 'easeOut',
    });
    return () => controls.stop();
  }, [value, motionValue]);

  return (
    <div className={`rounded-surface border-t-2 bg-elevated border border-line p-4 ${accentBorder[accent]} ${className}`}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <motion.div
        data-testid="kpi-value"
        className="mt-1.5 font-display text-2xl font-bold text-ink tabular-nums"
      >
        {display}
      </motion.div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
};
