import React from 'react';
import { Mail, FileEdit, RefreshCw } from 'lucide-react';
import { ProspectionModeToggle } from '../../components/ProspectionModeToggle';

export type Tab = 'validation' | 'templates' | 'followup';

interface ProspectionHeaderProps {
  mode: 'manual' | 'auto';
  onModeChange: (newMode: 'manual' | 'auto') => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const ProspectionHeader: React.FC<ProspectionHeaderProps> = ({
  mode,
  onModeChange,
  activeTab,
  setActiveTab,
}) => {
  return (
    <div className="flex flex-col gap-5 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              fontSize: "2.25rem",
              color: "var(--color-charcoal-fg, #f2ede4)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            Prospection
          </h1>
        </div>
        <ProspectionModeToggle mode={mode} onChange={onModeChange} />
      </div>

      <div className="flex items-center gap-2 flex-wrap font-ui">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-control transition-all cursor-pointer border ${
            activeTab === 'validation'
              ? 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus shadow-sm'
              : 'bg-surface text-ink-soft border-line-strong hover:text-ink hover:border-line-focus'
          }`}
          onClick={() => setActiveTab('validation')}
        >
          <Mail size={14} strokeWidth={2} /> Validation
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-control transition-all cursor-pointer border ${
            activeTab === 'templates'
              ? 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus shadow-sm'
              : 'bg-surface text-ink-soft border-line-strong hover:text-ink hover:border-line-focus'
          }`}
          onClick={() => setActiveTab('templates')}
        >
          <FileEdit size={14} strokeWidth={2} /> Templates
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-control transition-all cursor-pointer border ${
            activeTab === 'followup'
              ? 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus shadow-sm'
              : 'bg-surface text-ink-soft border-line-strong hover:text-ink hover:border-line-focus'
          }`}
          onClick={() => setActiveTab('followup')}
        >
          <RefreshCw size={14} strokeWidth={2} /> Relances
        </button>
      </div>
    </div>
  );
};
