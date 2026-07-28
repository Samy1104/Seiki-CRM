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
        className="page-title-heading font-display text-3xl font-extrabold text-white"
        style={{
          fontFamily: "'Sora', 'Codan', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: '2.25rem',
          color: '#ffffff',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
        }}
      >
        {children}
      </h1>
      {subtitle && <p className="mt-1 text-xs text-ink-soft">{subtitle}</p>}
    </div>
  );
};
