import React from 'react';
import { FileEdit, Mail, RefreshCw } from 'lucide-react';
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
    <>
      <div className="prospection-header">
        <div className="prospection-title">
          <FileEdit size={24} style={{ color: 'var(--color-amber)' }} />
          <h1 className="text-3xl font-bold">Prospection</h1>
          <span className="prospection-badge">Templates + fusion</span>
        </div>
        <ProspectionModeToggle mode={mode} onChange={onModeChange} />
      </div>

      <div className="prospection-tabs">
        <button
          className={`pros-tab ${activeTab === 'validation' ? 'active' : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          <Mail size={14} /> Validation
        </button>
        <button
          className={`pros-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileEdit size={14} /> Templates
        </button>
        <button
          className={`pros-tab ${activeTab === 'followup' ? 'active' : ''}`}
          onClick={() => setActiveTab('followup')}
        >
          <RefreshCw size={14} /> Relances
        </button>
      </div>
    </>
  );
};
