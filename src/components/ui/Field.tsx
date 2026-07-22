import React from 'react';

export interface FieldProps {
  label: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, className = '', children }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</label>
    {children}
  </div>
);

export const inputClass =
  'w-full rounded-control border border-line-strong bg-base px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-[#D4C4A8] placeholder:text-ink-faint';
