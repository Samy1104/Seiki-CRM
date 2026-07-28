import React from 'react';
import { Mail, FileEdit, RefreshCw, Link2, CheckCircle2, Activity } from 'lucide-react';
import { ProspectionModeToggle } from '../../components/ProspectionModeToggle';
import type { GmailAccount } from '../../services/gmailService';
import { PageTitle } from '../../components/ui/PageTitle';

export type Tab = 'validation' | 'templates' | 'followup' | 'tracking';

interface ProspectionHeaderProps {
  mode: 'manual' | 'auto';
  onModeChange: (newMode: 'manual' | 'auto') => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  gmailAccount: GmailAccount | null;
  gmailConnectUrl: string;
}

export const ProspectionHeader: React.FC<ProspectionHeaderProps> = ({
  mode,
  onModeChange,
  activeTab,
  setActiveTab,
  gmailAccount,
  gmailConnectUrl,
}) => {
  return (
    <div className="flex flex-col gap-5 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <PageTitle>Prospection</PageTitle>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={gmailConnectUrl}
            className="text-xs flex items-center gap-2 px-3.5 py-2 rounded-control border border-line-strong bg-surface text-ink-soft hover:text-ink hover:border-line-focus transition-all duration-200 cursor-pointer"
          >
            {gmailAccount ? (
              <CheckCircle2 size={15} strokeWidth={2} className="text-success" />
            ) : (
              <Link2 size={15} strokeWidth={2} className="text-[#D4C4A8]" />
            )}
            <span className="font-medium">{gmailAccount ? `${gmailAccount.email} (Connecté)` : 'Connecter Gmail'}</span>
          </a>
          <ProspectionModeToggle mode={mode} onChange={onModeChange} />
        </div>
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
        <button
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-control transition-all cursor-pointer border ${
            activeTab === 'tracking'
              ? 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus shadow-sm'
              : 'bg-surface text-ink-soft border-line-strong hover:text-ink hover:border-line-focus'
          }`}
          onClick={() => setActiveTab('tracking')}
        >
          <Activity size={14} strokeWidth={2} /> Suivi
        </button>
      </div>
    </div>
  );
};
