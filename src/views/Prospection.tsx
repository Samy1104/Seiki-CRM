import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { settingsService } from '../services/settingsService';
import { gmailService, type GmailAccount } from '../services/gmailService';
import { ProspectionHeader, type Tab } from './prospection/ProspectionHeader';
import { ValidationTab } from './prospection/ValidationTab';
import { TemplatesTab } from './prospection/TemplatesTab';
import { FollowUpTab } from './prospection/FollowUpTab';
import { TrackingTab } from './prospection/TrackingTab';
import './prospection.css';

export const Prospection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('validation');
  const { showToast } = useToast();
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [gmailAccount, setGmailAccount] = useState<GmailAccount | null>(null);

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setMode(s.prospection_mode));
    gmailService.getAccount().then(setGmailAccount).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const gmailStatus = params.get('gmail');
    if (gmailStatus === 'connected') {
      showToast(`Compte Gmail "${params.get('email')}" connecté.`, 'success');
      gmailService.getAccount().then(setGmailAccount).catch(() => {});
    } else if (gmailStatus === 'error') {
      showToast(params.get('message') || 'Connexion Gmail échouée.', 'error');
    }
    if (gmailStatus) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="p-4 md:p-6 space-y-4 h-full flex flex-col overflow-y-auto">
      <div className="max-w-7xl w-full mx-auto space-y-4 flex-1 flex flex-col">
        {/* Header & Tabs */}
        <ProspectionHeader
          mode={mode}
          onModeChange={handleModeChange}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          gmailAccount={gmailAccount}
          gmailConnectUrl={gmailService.oauthConnectUrl()}
        />

        {/* Active Tab Content */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'validation' && <ValidationTab showToast={showToast} />}
          {activeTab === 'templates' && <TemplatesTab showToast={showToast} />}
          {activeTab === 'followup' && <FollowUpTab showToast={showToast} />}
          {activeTab === 'tracking' && <TrackingTab showToast={showToast} />}
        </div>
      </div>
    </div>
  );
};

export default Prospection;
