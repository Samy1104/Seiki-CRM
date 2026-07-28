import React from 'react';

interface PageTitleProps {
  children: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

export const PageTitle: React.FC<PageTitleProps> = ({ children, subtitle, className = '' }) => {
  return (
    <div className={className}>
      <h1 className="font-display text-3xl font-bold tracking-tight text-[#f2ede4]">
        {children}
      </h1>
      {subtitle && <p className="mt-1 text-xs text-ink-soft">{subtitle}</p>}
    </div>
  );
};
