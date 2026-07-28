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
        className="page-title-heading"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 900,
          fontSize: '2.25rem',
          color: 'var(--color-charcoal-fg, #f2ede4)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {children}
      </h1>
      {subtitle && <p className="mt-1 text-xs text-ink-soft">{subtitle}</p>}
    </div>
  );
};
