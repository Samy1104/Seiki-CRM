import React from 'react';

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning';

export interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-elevated text-ink-soft border-line-strong',
  success: 'bg-success/15 text-success border-success/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  warning: 'bg-amber-soft text-amber border-line-focus',
};

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, className = '' }) => (
  <span
    className={[
      'inline-flex items-center rounded-control border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
      toneClasses[tone],
      className,
    ].join(' ')}
  >
    {children}
  </span>
);
