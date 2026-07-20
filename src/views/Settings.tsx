import React, { useState } from 'react';
import { settingsService } from '../services/settingsService';
import type { TeamMember, PipelineStage } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { Users, Target, Sliders } from 'lucide-react';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';
import { confirmAction } from '../utils/confirmAction';
import { MembersTab } from './settings/MembersTab';
import { PipelineStagesTab } from './settings/PipelineStagesTab';
import { SlaTab } from './settings/SlaTab';
import { ProspectionSettingsTab } from './settings/ProspectionSettingsTab';

const AVATAR_COLORS = ['#6B5FE6', '#F5B731', '#4ADE80', '#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F97316'];

const TABS = [
  { id: 'members', label: "Membres de l'équipe", icon: Users },
  { id: 'pipeline', label: 'Étapes du Pipeline', icon: Target },
  { id: 'sla', label: 'Règles & SLA Globaux', icon: Sliders },
  { id: 'prospection', label: 'Prospection', icon: Sliders },
] as const;

export const Settings: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'members' | 'pipeline' | 'sla' | 'prospection'>('members');
  const [loading, setLoading] = useState(true);

  // Data lists
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  // Form states - Member
  const [newMemberFirstName, setNewMemberFirstName] = useState('');
  const [newMemberLastName, setNewMemberLastName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Form states - Stage
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6B5FE6');
  const [newStageIsWon, setNewStageIsWon] = useState(false);

  // Form states - SLA & General
  const [slaMedia, setSlaMedia] = useState(5);
  const [slaRetail, setSlaRetail] = useState(7);
  const [slaInstit, setSlaInstit] = useState(14);
  const [aiScoring, setAiScoring] = useState(false);

  // Form states - Prospection
  const [dailyQuota, setDailyQuota] = useState(100);
  const [followup1Days, setFollowup1Days] = useState(5);
  const [followup2Days, setFollowup2Days] = useState(10);
  const [archiveAfter, setArchiveAfter] = useState(2);

  const loadSettingsData = () => withLoadingState(async () => {
    const fetchedMembers = await settingsService.getTeamMembers();
    const fetchedStages = await settingsService.getPipelineStages();
    const fetchedSettings = await settingsService.getSettings();

    setMembers(fetchedMembers);
    setStages(fetchedStages);

    // Populate SLA & AI settings
    fetchedSettings.forEach(s => {
      if (s.key === 'sla_media' && s.value.days !== undefined) setSlaMedia(s.value.days);
      if (s.key === 'sla_retail' && s.value.days !== undefined) setSlaRetail(s.value.days);
      if (s.key === 'sla_instit' && s.value.days !== undefined) setSlaInstit(s.value.days);
      if (s.key === 'scoring_auto' && s.value.enabled !== undefined) setAiScoring(s.value.enabled);
      if (s.key === 'daily_send_quota' && s.value.count !== undefined) setDailyQuota(s.value.count);
      if (s.key === 'followup_1_days' && s.value.days !== undefined) setFollowup1Days(s.value.days);
      if (s.key === 'followup_2_days' && s.value.days !== undefined) setFollowup2Days(s.value.days);
      if (s.key === 'archive_after_followups' && s.value.count !== undefined) setArchiveAfter(s.value.count);
    });
  }, {
    setLoading,
    onError: (err) => {
      console.error('Error loading settings data:', err);
      showToast('Erreur lors du chargement des paramètres', 'error');
    }
  });

  useLoadOnMount(loadSettingsData);

  // Team Member Actions
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberFirstName.trim() || !newMemberLastName.trim()) {
      showToast('Le prénom et le nom sont requis', 'error');
      return;
    }

    try {
      // 1. Format First Name (Title Case)
      const firstName = newMemberFirstName.trim()
        .split('-')
        .map(sub => sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase())
        .join('-');

      // 2. Format Last Name (UPPERCASE with accents)
      const lastName = newMemberLastName.trim().toUpperCase();

      const fullName = `${firstName} ${lastName}`;
      const initials = (firstName[0] + (lastName[0] || '')).toUpperCase();

      if (editingMemberId) {
        // Update member
        await settingsService.updateTeamMember(editingMemberId, {
          full_name: fullName,
          email: newMemberEmail.trim() || null,
          initials
        });
        showToast('Membre modifié avec succès');
        setEditingMemberId(null);
      } else {
        // Create member
        const assignedColor = AVATAR_COLORS[members.length % AVATAR_COLORS.length];
        await settingsService.addTeamMember({
          full_name: fullName,
          email: newMemberEmail.trim() || null,
          initials,
          color: assignedColor,
          role_label: 'Collaborateur',
          is_active: true
        });
        showToast('Membre ajouté');
      }

      setNewMemberFirstName('');
      setNewMemberLastName('');
      setNewMemberEmail('');
      loadSettingsData();
    } catch (err) {
      console.error('Error saving member:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleStartEdit = (member: TeamMember) => {
    setEditingMemberId(member.id);
    const nameParts = member.full_name.split(/\s+/);
    setNewMemberFirstName(nameParts[0] || '');
    setNewMemberLastName(nameParts.slice(1).join(' ') || '');
    setNewMemberEmail(member.email || '');
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setNewMemberFirstName('');
    setNewMemberLastName('');
    setNewMemberEmail('');
  };

  const handleDeleteMember = async (id: string) => {
    if (confirmAction('Retirer ce membre de l\'équipe ?')) {
      try {
        await settingsService.deleteTeamMember(id);
        showToast('Membre retiré');
        loadSettingsData();
      } catch (err) {
        console.error('Error deleting member:', err);
        showToast('Erreur lors du retrait', 'error');
      }
    }
  };

  // Pipeline Stage Actions
  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;

    try {
      const maxPosition = stages.length ? Math.max(...stages.map(s => s.position)) : 0;
      await settingsService.addPipelineStage({
        name: newStageName.trim(),
        position: maxPosition + 1,
        color: newStageColor,
        is_closed_won: newStageIsWon,
        is_active: true
      });

      setNewStageName('');
      setNewStageIsWon(false);

      showToast('Étape ajoutée au pipeline');
      loadSettingsData();
    } catch (err) {
      console.error('Error adding stage:', err);
      showToast('Erreur lors de la création de l\'étape', 'error');
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (stages.length <= 2) {
      showToast('Le pipeline doit comporter au moins deux étapes', 'error');
      return;
    }

    if (confirmAction('Supprimer cette étape ? Assurez-vous de déplacer les leads actifs en amont.')) {
      try {
        await settingsService.deletePipelineStage(id);
        showToast('Étape supprimée');
        loadSettingsData();
      } catch (err) {
        console.error('Error deleting stage:', err);
        showToast('Erreur de suppression', 'error');
      }
    }
  };

  // SLA & general settings handlers
  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await settingsService.updateSetting('sla_media', { days: slaMedia });
      await settingsService.updateSetting('sla_retail', { days: slaRetail });
      await settingsService.updateSetting('sla_instit', { days: slaInstit });
      await settingsService.updateSetting('scoring_auto', { enabled: aiScoring });

      showToast('Paramètres généraux sauvegardés ✓');
      loadSettingsData();
    } catch (err) {
      console.error('Error saving settings:', err);
      showToast('Erreur de sauvegarde des paramètres', 'error');
    }
  };

  const handleSaveProspectionSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await settingsService.updateProspectionSettings({
        daily_send_quota: dailyQuota,
        followup_1_days: followup1Days,
        followup_2_days: followup2Days,
        archive_after_followups: archiveAfter,
      });
      showToast('Paramètres de prospection sauvegardés ✓');
      loadSettingsData();
    } catch (err) {
      console.error('Error saving prospection settings:', err);
      showToast('Erreur de sauvegarde des paramètres', 'error');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="mt-3 text-ink-soft">Chargement des paramètres...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <div className="font-display text-xl font-bold text-ink">Paramètres</div>
        <div className="mt-0.5 text-xs text-ink-soft">Configuration globale de l'espace de travail</div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-line">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                isActive ? 'border-amber text-ink' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'members' && (
        <MembersTab
          members={members}
          editingMemberId={editingMemberId}
          firstName={newMemberFirstName}
          lastName={newMemberLastName}
          email={newMemberEmail}
          onFirstNameChange={setNewMemberFirstName}
          onLastNameChange={setNewMemberLastName}
          onEmailChange={setNewMemberEmail}
          onSubmit={handleAddMember}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onDelete={handleDeleteMember}
        />
      )}

      {activeTab === 'pipeline' && (
        <PipelineStagesTab
          stages={stages}
          newStageName={newStageName}
          newStageColor={newStageColor}
          newStageIsWon={newStageIsWon}
          onNameChange={setNewStageName}
          onColorChange={setNewStageColor}
          onIsWonChange={setNewStageIsWon}
          onSubmit={handleAddStage}
          onDelete={handleDeleteStage}
        />
      )}

      {activeTab === 'sla' && (
        <SlaTab
          slaMedia={slaMedia}
          slaRetail={slaRetail}
          slaInstit={slaInstit}
          aiScoring={aiScoring}
          onSlaMediaChange={setSlaMedia}
          onSlaRetailChange={setSlaRetail}
          onSlaInstitChange={setSlaInstit}
          onAiScoringChange={setAiScoring}
          onSubmit={handleSaveGeneralSettings}
        />
      )}

      {activeTab === 'prospection' && (
        <ProspectionSettingsTab
          dailyQuota={dailyQuota}
          followup1Days={followup1Days}
          followup2Days={followup2Days}
          archiveAfter={archiveAfter}
          onDailyQuotaChange={setDailyQuota}
          onFollowup1DaysChange={setFollowup1Days}
          onFollowup2DaysChange={setFollowup2Days}
          onArchiveAfterChange={setArchiveAfter}
          onSubmit={handleSaveProspectionSettings}
        />
      )}
    </div>
  );
};
