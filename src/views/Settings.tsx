import React, { useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import type { TeamMember, PipelineStage } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { Users, Target, Sliders, Plus, Trash2, Edit2 } from 'lucide-react';

const AVATAR_COLORS = ['#6B5FE6', '#F5B731', '#4ADE80', '#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F97316'];

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

  const loadSettingsData = async () => {
    try {
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
    } catch (err) {
      console.error('Error loading settings data:', err);
      showToast('Erreur lors du chargement des paramètres', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

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
    if (window.confirm('Retirer ce membre de l\'équipe ?')) {
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

    if (window.confirm('Supprimer cette étape ? Assurez-vous de déplacer les leads actifs en amont.')) {
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
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Chargement des paramètres...</div>
      </div>
    );
  }

  return (
    <div className="view-section on">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Paramètres</div>
          <div className="page-sub">Configuration globale de l'espace de travail</div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="tab-row" style={{ marginBottom: '20px' }}>
        <button 
          className={`mtab ${activeTab === 'members' ? 'on' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={14} style={{ marginRight: '6px' }} />
          Membres de l'équipe
        </button>
        <button 
          className={`mtab ${activeTab === 'pipeline' ? 'on' : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >
          <Target size={14} style={{ marginRight: '6px' }} />
          Étapes du Pipeline
        </button>
        <button
          className={`mtab ${activeTab === 'sla' ? 'on' : ''}`}
          onClick={() => setActiveTab('sla')}
        >
          <Sliders size={14} style={{ marginRight: '6px' }} />
          Règles & SLA Globaux
        </button>
        <button
          className={`mtab ${activeTab === 'prospection' ? 'on' : ''}`}
          onClick={() => setActiveTab('prospection')}
        >
          <Sliders size={14} style={{ marginRight: '6px' }} />
          Prospection
        </button>
      </div>

      {/* 1. MEMBERS TAB PANEL */}
      {activeTab === 'members' && (
        <div className="two-col" style={{ gap: '20px' }}>
          {/* Member List */}
          <div className="card" style={{ padding: '20px', flex: '1.5' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
              Membres actifs
            </div>
            
            <div className="leads-table-container">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Avatar</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td style={{ width: '50px' }}>
                        <div 
                          className="member-avatar" 
                          style={{ 
                            background: m.color, 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: '#fff', 
                            fontWeight: '700', 
                            fontSize: '12px' 
                          }}
                        >
                          {m.initials}
                        </div>
                      </td>
                      <td style={{ fontWeight: '500' }}>{m.full_name}</td>
                      <td>{m.email || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn-icon-del" 
                            onClick={() => handleStartEdit(m)}
                            title="Modifier le membre"
                            style={{ padding: '6px', color: 'var(--text-secondary)' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            className="btn-icon-del" 
                            onClick={() => handleDeleteMember(m.id)}
                            title="Retirer le membre"
                            style={{ padding: '6px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add / Edit Member Form */}
          <div className="card" style={{ padding: '20px', flex: '1' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
              {editingMemberId ? 'Modifier le membre' : 'Ajouter un membre'}
            </div>
            
            <form onSubmit={handleAddMember}>
              <div className="form-field" style={{ marginBottom: '12px' }}>
                <div className="field-label">Prénom *</div>
                <input 
                  type="text" 
                  placeholder="ex : Marie"
                  value={newMemberFirstName}
                  onChange={e => setNewMemberFirstName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field" style={{ marginBottom: '12px' }}>
                <div className="field-label">NOM *</div>
                <input 
                  type="text" 
                  placeholder="ex : DURAND"
                  value={newMemberLastName}
                  onChange={e => setNewMemberLastName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field" style={{ marginBottom: '16px' }}>
                <div className="field-label">Email</div>
                <input 
                  type="email" 
                  placeholder="marie@entreprise.com"
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-grad" style={{ flex: '1' }}>
                  {editingMemberId ? 'Enregistrer' : 'Ajouter'}
                </button>
                {editingMemberId && (
                  <button type="button" className="btn" onClick={handleCancelEdit}>
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. PIPELINE TAB PANEL */}
      {activeTab === 'pipeline' && (
        <div className="two-col" style={{ gap: '20px' }}>
          {/* Stage List */}
          <div className="card" style={{ padding: '20px', flex: '1.5' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
              Étapes du processus commercial
            </div>
            
            <div className="leads-table-container">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Nom</th>
                    <th>Couleur</th>
                    <th>Gagné final ?</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map(st => (
                    <tr key={st.id}>
                      <td style={{ fontWeight: '600' }}>#{st.position}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-h)' }}>{st.name}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: st.color }}></span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{st.color}</span>
                        </div>
                      </td>
                      <td>
                        {st.is_closed_won ? (
                          <span className="badge badge-success" style={{ fontSize: '9px' }}>Gagné</span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '9px' }}>Actif</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="hist-btn del" 
                          onClick={() => handleDeleteStage(st.id)}
                          disabled={st.is_closed_won}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Stage Form */}
          <div className="card" style={{ padding: '20px', flex: '1' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
              Ajouter une étape
            </div>
            
            <form onSubmit={handleAddStage}>
              <div className="form-field" style={{ marginBottom: '12px' }}>
                <div className="field-label">Nom de l'étape *</div>
                <input 
                  type="text" 
                  placeholder="ex : Négociation"
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field" style={{ marginBottom: '12px' }}>
                <div className="field-label">Couleur de l'étape</div>
                <input 
                  type="color" 
                  value={newStageColor}
                  onChange={e => setNewStageColor(e.target.value)}
                  style={{ height: '36px', padding: '2px', cursor: 'pointer' }}
                />
              </div>

              <div className="form-field" style={{ marginBottom: '20px', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  id="stage-won"
                  checked={newStageIsWon}
                  onChange={e => setNewStageIsWon(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="stage-won" style={{ fontSize: '12px', color: 'var(--text-h)', cursor: 'pointer', userSelect: 'none' }}>
                  Marquer comme étape finale de succès (Gagné)
                </label>
              </div>

              <button type="submit" className="btn btn-grad" style={{ width: '100%' }}>
                <Plus size={14} style={{ marginRight: '4px' }} />
                Créer l'étape
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. SLA & GENERAL SETTINGS PANEL */}
      {activeTab === 'sla' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
            Règles SLA et automatisation
          </div>

          <form onSubmit={handleSaveGeneralSettings}>
            <div className="form-grid" style={{ marginBottom: '24px' }}>
              {/* Media SLA */}
              <div className="form-field">
                <div className="field-label">SLA Segment Media (jours maximum)</div>
                <input 
                  type="number" 
                  value={slaMedia}
                  onChange={e => setSlaMedia(parseInt(e.target.value) || 1)}
                  min={1}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Alerte déclenchée si un lead du segment Media stagne plus de {slaMedia} jours dans la même étape.
                </span>
              </div>

              {/* Retail SLA */}
              <div className="form-field">
                <div className="field-label">SLA Segment Retail (jours maximum)</div>
                <input 
                  type="number" 
                  value={slaRetail}
                  onChange={e => setSlaRetail(parseInt(e.target.value) || 1)}
                  min={1}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Alerte déclenchée si un lead du segment Retail stagne plus de {slaRetail} jours.
                </span>
              </div>

              {/* Instit SLA */}
              <div className="form-field">
                <div className="field-label">SLA Segment Instit (jours maximum)</div>
                <input 
                  type="number" 
                  value={slaInstit}
                  onChange={e => setSlaInstit(parseInt(e.target.value) || 1)}
                  min={1}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Alerte déclenchée si un lead du segment Instit stagne plus de {slaInstit} jours.
                </span>
              </div>

              {/* AI Auto scoring */}
              <div className="form-field" style={{ gridColumn: 'span 2', marginTop: '10px', borderTop: '0.5px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-h)', fontSize: '13px' }}>Enrichissement et scoring automatique</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Calculer automatiquement le score ICP et préremplir les critères à la création d'un lead (via données d'enrichissement mail/domaine).
                    </div>
                  </div>
                  
                  {/* Custom Toggle Switch */}
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={aiScoring}
                      onChange={e => setAiScoring(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-grad">
              Enregistrer les paramètres
            </button>
          </form>
        </div>
      )}

      {activeTab === 'prospection' && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Quota d'envoi et relances
          </div>

          <form onSubmit={handleSaveProspectionSettings}>
            <div className="form-grid" style={{ marginBottom: '24px' }}>
              <div className="form-field">
                <div className="field-label">Quota d'envoi quotidien</div>
                <input type="number" value={dailyQuota} onChange={(e) => setDailyQuota(parseInt(e.target.value) || 1)} min={1} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Limite Resend : ne pas dépasser {dailyQuota} emails envoyés par jour.
                </span>
              </div>

              <div className="form-field">
                <div className="field-label">Délai avant 1ère relance (jours)</div>
                <input type="number" value={followup1Days} onChange={(e) => setFollowup1Days(parseInt(e.target.value) || 1)} min={1} />
              </div>

              <div className="form-field">
                <div className="field-label">Délai avant 2ème relance (jours)</div>
                <input type="number" value={followup2Days} onChange={(e) => setFollowup2Days(parseInt(e.target.value) || 1)} min={1} />
              </div>

              <div className="form-field">
                <div className="field-label">Relances avant archivage</div>
                <input type="number" value={archiveAfter} onChange={(e) => setArchiveAfter(parseInt(e.target.value) || 1)} min={1} />
              </div>
            </div>

            <button type="submit" className="btn btn-grad">Enregistrer les paramètres</button>
          </form>
        </div>
      )}
    </div>
  );
};
