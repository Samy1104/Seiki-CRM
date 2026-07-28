import React from 'react';

interface PageTitleProps {
  children: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

export const PageTitle: React.FC<PageTitleProps> = ({ children, subtitle, className = '' }) => {
  return (
    <div className={className}>
      <h1
        className="font-display text-3xl font-bold text-ink"
        style={{
          fontFamily: "'Sora', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: '1.875rem',
          lineHeight: '2.25rem',
          color: 'var(--color-ink, #F5F5F4)',
        }}
      >
        {children}
      </h1>
      {subtitle && <p className="mt-1 text-xs text-ink-soft">{subtitle}</p>}
    </div>
  );
};
