import React, { useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import type { AppSetting, TeamMember, PipelineStage } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { Users, Target, Sliders } from 'lucide-react';
import { useCachedResource } from '../hooks/useCachedResource';
import { confirmAction } from '../utils/confirmAction';
import { MembersTab } from './settings/MembersTab';
import { PipelineStagesTab } from './settings/PipelineStagesTab';
import { SlaTab } from './settings/SlaTab';
import { ProspectionSettingsTab } from './settings/ProspectionSettingsTab';
import { DashboardTargetsSettings } from './settings/DashboardTargetsSettings';
import { PageTitle } from '../components/ui/PageTitle';

const AVATAR_COLORS = ['#6B5FE6', '#F5B731', '#4ADE80', '#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F97316'];

const TABS = [
  { id: 'members', label: "Membres de l'équipe", icon: Users },
  { id: 'pipeline', label: 'Étapes du Pipeline', icon: Target },
  { id: 'sla', label: 'Règles & SLA Globaux', icon: Sliders },
  { id: 'prospection', label: 'Prospection', icon: Sliders },
  { id: 'dashboard', label: 'Objectifs & CODIR', icon: Target },
] as const;

export const Settings: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'members' | 'pipeline' | 'sla' | 'prospection' | 'dashboard'>('members');

  // Form states - Member
  const [newMemberFirstName, setNewMemberFirstName] = useState('');
  const [newMemberLastName, setNewMemberLastName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Form states - Stage
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6B5FE6');
  const [newStageIsWon, setNewStageIsWon] = useState(false);
  const [newStageIsLost, setNewStageIsLost] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);

  // Form states - SLA & General
  const [slaMedia, setSlaMedia] = useState(5);
  const [slaRetail, setSlaRetail] = useState(7);
  const [slaInstit, setSlaInstit] = useState(14);
  const [aiScoring, setAiScoring] = useState(false);

  // Form states - Prospection
  const [gmailDailyCap, setGmailDailyCap] = useState<number | null>(null);
  const [gmailWarmupStartDate, setGmailWarmupStartDate] = useState<string | null>(null);
  const [gmailWindowStart, setGmailWindowStart] = useState('08:00');
  const [gmailWindowEnd, setGmailWindowEnd] = useState('18:00');
  const [gmailFromName, setGmailFromName] = useState('Seiki CRM');
  const [followup1Days, setFollowup1Days] = useState(5);
  const [followup2Days, setFollowup2Days] = useState(10);
  const [archiveAfter, setArchiveAfter] = useState(2);
  const [replyAiClassificationEnabled, setReplyAiClassificationEnabled] = useState(true);
  const [replyPositiveStageId, setReplyPositiveStageId] = useState<string | null>(null);
  const [replyNegativeStageId, setReplyNegativeStageId] = useState<string | null>(null);

  const onError = (err: unknown) => {
    console.error('Error loading settings data:', err);
    showToast('Erreur lors du chargement des paramètres', 'error');
  };

  const membersRes = useCachedResource('teamMembers', () => settingsService.getTeamMembers(), [], { onError });
  const stagesRes = useCachedResource('pipelineStages', () => settingsService.getPipelineStages(), [], { onError });
  const settingsRes = useCachedResource<AppSetting[]>('appSettings', () => settingsService.getSettings(), [], { onError });

  const members = membersRes.data;
  const stages = stagesRes.data;
  const loading = membersRes.loading || stagesRes.loading || settingsRes.loading;

  const loadSettingsData = () => Promise.all([
    membersRes.reload(),
    stagesRes.reload(),
    settingsRes.reload(),
  ]).then(() => {});

  // Populate SLA & AI settings whenever the fetched settings change
  useEffect(() => {
    settingsRes.data.forEach(s => {
      if (s.key === 'sla_media' && s.value.days !== undefined && typeof s.value.days === 'number') setSlaMedia(s.value.days);
      if (s.key === 'sla_retail' && s.value.days !== undefined && typeof s.value.days === 'number') setSlaRetail(s.value.days);
      if (s.key === 'sla_instit' && s.value.days !== undefined && typeof s.value.days === 'number') setSlaInstit(s.value.days);
      if (s.key === 'scoring_auto' && s.value.enabled !== undefined) setAiScoring(s.value.enabled);
      if (s.key === 'gmail_daily_cap' && s.value.count !== undefined) setGmailDailyCap(s.value.count);
      if (s.key === 'gmail_warmup_start_date' && s.value.date !== undefined) setGmailWarmupStartDate(s.value.date);
      if (s.key === 'gmail_send_window') {
        if (s.value.start !== undefined) setGmailWindowStart(s.value.start);
        if (s.value.end !== undefined) setGmailWindowEnd(s.value.end);
      }
      if (s.key === 'gmail_from_name' && s.value.name !== undefined) setGmailFromName(s.value.name);
      if (s.key === 'followup_1_days' && s.value.days !== undefined && typeof s.value.days === 'number') setFollowup1Days(s.value.days);
      if (s.key === 'followup_2_days' && s.value.days !== undefined && typeof s.value.days === 'number') setFollowup2Days(s.value.days);
      if (s.key === 'archive_after_followups' && s.value.count !== undefined) setArchiveAfter(s.value.count);
      if (s.key === 'reply_ai_classification_enabled' && s.value.enabled !== undefined) setReplyAiClassificationEnabled(s.value.enabled);
      if (s.key === 'reply_positive_stage_id') setReplyPositiveStageId(s.value.stage_id ?? null);
      if (s.key === 'reply_negative_stage_id') setReplyNegativeStageId(s.value.stage_id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRes.data]);

  // Team Member Actions
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberFirstName.trim() || !newMemberLastName.trim()) {
      showToast('Le prénom et le nom sont requis', 'error');
      return;
    }

    try {
      const firstName = newMemberFirstName.trim()
        .split('-')
        .map(sub => sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase())
        .join('-');

      const lastName = newMemberLastName.trim().toUpperCase();
      const fullName = `${firstName} ${lastName}`;
      const initials = (firstName[0] + (lastName[0] || '')).toUpperCase();

      if (editingMemberId) {
        await settingsService.updateTeamMember(editingMemberId, {
          full_name: fullName,
          email: newMemberEmail.trim() || null,
          initials
        });
        showToast('Membre modifié avec succès');
        setEditingMemberId(null);
      } else {
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
      if (editingStageId) {
        await settingsService.updatePipelineStage(editingStageId, {
          name: newStageName.trim(),
          color: newStageColor,
          is_closed_won: newStageIsWon,
          is_closed_lost: newStageIsLost,
        });
        showToast('Étape modifiée avec succès');
        setEditingStageId(null);
      } else {
        const maxPosition = stages.length ? Math.max(...stages.map(s => s.position)) : 0;
        await settingsService.addPipelineStage({
          name: newStageName.trim(),
          position: maxPosition + 1,
          color: newStageColor,
          is_closed_won: newStageIsWon,
          is_closed_lost: newStageIsLost,
          is_active: true
        });
        showToast('Étape ajoutée au pipeline');
      }

      setNewStageName('');
      setNewStageColor('#6B5FE6');
      setNewStageIsWon(false);
      setNewStageIsLost(false);

      loadSettingsData();
    } catch (err) {
      console.error('Error saving stage:', err);
      showToast('Erreur lors de la sauvegarde de l\'étape', 'error');
    }
  };

  const handleStartEditStage = (stage: PipelineStage) => {
    setEditingStageId(stage.id);
    setNewStageName(stage.name);
    setNewStageColor(stage.color || '#6B5FE6');
    setNewStageIsWon(!!stage.is_closed_won);
    setNewStageIsLost(!!stage.is_closed_lost);
  };

  const handleCancelEditStage = () => {
    setEditingStageId(null);
    setNewStageName('');
    setNewStageColor('#6B5FE6');
    setNewStageIsWon(false);
    setNewStageIsLost(false);
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

  const handleMoveStage = async (id: string, direction: 'up' | 'down') => {
    const index = stages.findIndex(s => s.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const currentStage = stages[index];
    const targetStage = stages[targetIndex];

    try {
      await settingsService.reorderPipelineStages(
        currentStage.id, currentStage.position,
        targetStage.id, targetStage.position
      );
      showToast('Ordre des étapes mis à jour');
      loadSettingsData();
    } catch (err) {
      console.error('Error reordering stages:', err);
      showToast('Erreur lors du réordonnancement', 'error');
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
        followup_1_days: followup1Days,
        followup_2_days: followup2Days,
        archive_after_followups: archiveAfter,
        gmail_daily_cap: gmailDailyCap,
        gmail_warmup_start_date: gmailWarmupStartDate,
        gmail_send_window: { days: [1, 2, 3, 4, 5], start: gmailWindowStart, end: gmailWindowEnd },
        gmail_from_name: gmailFromName,
        reply_ai_classification_enabled: replyAiClassificationEnabled,
        reply_positive_stage_id: replyPositiveStageId,
        reply_negative_stage_id: replyNegativeStageId,
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
        <PageTitle subtitle="Gérez les membres de l'équipe, le pipeline commercial, les règles SLA et la prospection.">
          Paramètres
        </PageTitle>
      </div>

      <div className="flex items-center gap-2 flex-wrap font-ui my-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-control transition-all cursor-pointer border ${
                isActive
                  ? 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus shadow-sm'
                  : 'bg-surface text-ink-soft border-line-strong hover:text-ink hover:border-line-focus'
              }`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              <Icon size={14} strokeWidth={2} />
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
          editingStageId={editingStageId}
          newStageName={newStageName}
          newStageColor={newStageColor}
          newStageIsWon={newStageIsWon}
          newStageIsLost={newStageIsLost}
          onNameChange={setNewStageName}
          onColorChange={setNewStageColor}
          onIsWonChange={setNewStageIsWon}
          onIsLostChange={setNewStageIsLost}
          onSubmit={handleAddStage}
          onStartEdit={handleStartEditStage}
          onCancelEdit={handleCancelEditStage}
          onDelete={handleDeleteStage}
          onMoveStage={handleMoveStage}
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
          followup1Days={followup1Days}
          followup2Days={followup2Days}
          archiveAfter={archiveAfter}
          gmailDailyCap={gmailDailyCap}
          gmailWarmupStartDate={gmailWarmupStartDate}
          gmailWindowStart={gmailWindowStart}
          gmailWindowEnd={gmailWindowEnd}
          gmailFromName={gmailFromName}
          pipelineStages={stages}
          replyAiClassificationEnabled={replyAiClassificationEnabled}
          replyPositiveStageId={replyPositiveStageId}
          replyNegativeStageId={replyNegativeStageId}
          onFollowup1DaysChange={setFollowup1Days}
          onFollowup2DaysChange={setFollowup2Days}
          onArchiveAfterChange={setArchiveAfter}
          onGmailDailyCapChange={setGmailDailyCap}
          onGmailWarmupStartDateChange={setGmailWarmupStartDate}
          onGmailWindowStartChange={setGmailWindowStart}
          onGmailWindowEndChange={setGmailWindowEnd}
          onGmailFromNameChange={setGmailFromName}
          onReplyAiClassificationEnabledChange={setReplyAiClassificationEnabled}
          onReplyPositiveStageIdChange={setReplyPositiveStageId}
          onReplyNegativeStageIdChange={setReplyNegativeStageId}
          onSubmit={handleSaveProspectionSettings}
        />
      )}

      {activeTab === 'dashboard' && (
        <DashboardTargetsSettings />
      )}
    </div>
  );
};
