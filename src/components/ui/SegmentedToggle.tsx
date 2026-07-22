import React from 'react';

export interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedToggleProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedToggleOption<T>[];
}

export function SegmentedToggle<T extends string>({ value, onChange, options }: SegmentedToggleProps<T>) {
  return (
    <div
      className="flex items-center p-1 rounded-lg"
      style={{
        background: "#141414",
        border: "1px solid rgba(242,237,228,0.08)",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] uppercase tracking-[0.12em] font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: active ? 'rgba(212,196,168,0.14)' : 'transparent',
              color: active ? 'var(--color-beige, #D4C4A8)' : '#666',
              border: active ? '1px solid rgba(212,196,168,0.25)' : '1px solid transparent',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
