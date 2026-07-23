import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { settingsService } from '../services/settingsService';
import { ProspectionHeader, type Tab } from './prospection/ProspectionHeader';
import { ValidationTab } from './prospection/ValidationTab';
import { TemplatesTab } from './prospection/TemplatesTab';
import { FollowUpTab } from './prospection/FollowUpTab';
import './prospection.css';

export const Prospection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('validation');
  const { showToast } = useToast();
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setMode(s.prospection_mode));
  }, []);

  const handleModeChange = async (newMode: 'manual' | 'auto') => {
    const previousMode = mode;
    setMode(newMode);
    try {
      await settingsService.updateProspectionSettings({ prospection_mode: newMode });
      showToast(`Mode ${newMode === 'auto' ? 'automatique' : 'vérification humaine'} activé`, 'success');
    } catch {
      setMode(previousMode);
      showToast('Erreur changement de mode', 'error');
    }
  };

  return (
    <div className="p-8 space-y-6" style={{ overflowY: 'auto' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header & Tabs */}
        <ProspectionHeader
          mode={mode}
          onModeChange={handleModeChange}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Active Tab Content */}
        <div>
          {activeTab === 'validation' && <ValidationTab showToast={showToast} />}
          {activeTab === 'templates' && <TemplatesTab showToast={showToast} />}
          {activeTab === 'followup' && <FollowUpTab showToast={showToast} />}
        </div>
      </div>
    </div>
  );
};

export default Prospection;
