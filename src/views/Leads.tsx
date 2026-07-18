import React, { useMemo, useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead, MergeProposal } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { TeamMember } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { Search, Filter, Layers } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { confirmAction } from '../utils/confirmAction';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';

interface LeadsProps {
  setView: (view: string) => void;
}

export const Leads: React.FC<LeadsProps> = () => {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [mergeProposals, setMergeProposals] = useState<MergeProposal[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState(''); // 'hot' (>=80), 'qualified' (60-79), 'nurturing' (<60)
  const [ownerFilter, setOwnerFilter] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<boolean>(false);

  // Modal State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadLeadsData = () => withLoadingState(async () => {
    const fetchedLeads = await leadsService.getLeads(archiveFilter);
    const fetchedMembers = await settingsService.getTeamMembers();
    const proposals = await leadsService.getMergeProposals();

    setLeads(fetchedLeads);
    setTeamMembers(fetchedMembers);
    setMergeProposals(proposals);
  }, {
    setLoading,
    onError: (err) => {
      console.error('Error loading leads data:', err);
      showToast('Erreur lors du chargement', 'error');
    }
  });

  useLoadOnMount(loadLeadsData, [archiveFilter]);

  const handleOpenLead = async (leadId: string) => {
    try {
      const leadDetails = await leadsService.getLeadById(leadId);
      setSelectedLead(leadDetails);
      setModalOpen(true);
    } catch (err) {
      console.error('Error loading lead details:', err);
      showToast('Erreur de chargement du lead', 'error');
    }
  };

  const handleMergeApprove = async (proposalId: string) => {
    if (confirmAction('Êtes-vous sûr de vouloir fusionner ces deux leads ? L\'historique et les tâches seront fusionnés.')) {
      try {
        await leadsService.resolveMergeProposal(proposalId, 'approved');
        showToast('Leads fusionnés avec succès');
        loadLeadsData();
      } catch (err) {
        console.error('Error resolving merge:', err);
        showToast('Erreur de fusion', 'error');
      }
    }
  };

  const handleMergeReject = async (proposalId: string) => {
    try {
      await leadsService.resolveMergeProposal(proposalId, 'rejected');
      showToast('Proposition ignorée');
      loadLeadsData();
    } catch (err) {
      console.error('Error rejecting merge:', err);
      showToast('Erreur lors du rejet', 'error');
    }
  };

  // Filter Logic
  const filteredLeads = useMemo(() => leads.filter(l => {
    // Search query
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      (l.company_name || '').toLowerCase().includes(searchLower) ||
      (l.contact_name || '').toLowerCase().includes(searchLower) ||
      (l.email && l.email.toLowerCase().includes(searchLower)) ||
      (l.note && l.note.toLowerCase().includes(searchLower));

    // Segment
    const matchesSegment = !segmentFilter || l.segment === segmentFilter;

    // Score
    let matchesScore = true;
    if (scoreFilter === 'hot') matchesScore = l.score >= 80;
    else if (scoreFilter === 'qualified') matchesScore = l.score >= 60 && l.score < 80;
    else if (scoreFilter === 'nurturing') matchesScore = l.score < 60;

    // Owner
    const matchesOwner = !ownerFilter || l.owner_id === ownerFilter;

    return matchesSearch && matchesSegment && matchesScore && matchesOwner;
  }), [leads, searchQuery, segmentFilter, scoreFilter, ownerFilter]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Chargement des Leads...</div>
      </div>
    );
  }

  return (
    <div className="view-section on">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Tous les leads</div>
          <div className="page-sub">
            {filteredLeads.length} de {leads.length} lead{leads.length !== 1 ? 's' : ''} affiché{filteredLeads.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn btn-sm ${!archiveFilter ? 'btn-grad' : ''}`}
            onClick={() => setArchiveFilter(false)}
          >
            Actifs
          </button>
          <button 
            className={`btn btn-sm ${archiveFilter ? 'btn-grad' : ''}`}
            onClick={() => setArchiveFilter(true)}
          >
            Archivés
          </button>
        </div>
      </div>

      {/* Duplicate / Merge Proposals */}
      {mergeProposals.length > 0 && !archiveFilter && (
        <div className="merge-alert-container">
          <div className="merge-alert-header">
            <Layers size={16} className="merge-alert-icon" />
            <span>{mergeProposals.length} proposition{mergeProposals.length > 1 ? 's' : ''} de fusion (doublons détectés par domaine email)</span>
          </div>
          <div className="merge-proposals-list">
            {mergeProposals.map(p => (
              <div key={p.id} className="merge-prop-card">
                <div>
                  <strong>{p.source_lead?.company_name}</strong> ({p.source_lead?.contact_name}) 
                  <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>⇄</span>
                  <strong>{p.target_lead?.company_name}</strong> ({p.target_lead?.contact_name})
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Raison : Même nom de domaine email ({p.source_lead?.email?.split('@')[1]})
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-sm btn-grad" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleMergeApprove(p.id)}>
                    Fusionner
                  </button>
                  <button className="btn btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleMergeReject(p.id)}>
                    Ignorer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Box */}
      <div className="leads-filters-container">
        <div className="search-box-wrap">
          <Search size={14} className="search-box-icon" />
          <input 
            type="text" 
            placeholder="Rechercher par société, contact, note..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-group-wrap">
          <div className="filter-item-wrap">
            <Filter size={12} className="filter-icon" />
            <Select value={segmentFilter} onValueChange={val => setSegmentFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les segments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les segments</SelectItem>
                <SelectItem value="Media">Media</SelectItem>
                <SelectItem value="Retail">Retail</SelectItem>
                <SelectItem value="Instit">Instit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="filter-item-wrap">
            <Filter size={12} className="filter-icon" />
            <Select value={scoreFilter} onValueChange={val => setScoreFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les scores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les scores</SelectItem>
                <SelectItem value="hot">Chauds (≥ 80)</SelectItem>
                <SelectItem value="qualified">Qualifiés (60-79)</SelectItem>
                <SelectItem value="nurturing">Nurturing (&lt; 60)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="filter-item-wrap">
            <Filter size={12} className="filter-icon" />
            <Select value={ownerFilter} onValueChange={val => setOwnerFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les propriétaires" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les propriétaires</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Leads Table List */}
      <div className="leads-table-container">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Société</th>
              <th>Contact</th>
              <th>Segment</th>
              <th>Étape</th>
              <th>Score ICP</th>
              <th>Valeur</th>
              <th>Propriétaire</th>
              <th>Créé le</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length > 0 ? (
              filteredLeads.map(l => {
                const scoreColor = l.score >= 80 ? 'var(--green)' : l.score >= 60 ? 'var(--gold)' : 'var(--red)';
                
                return (
                  <tr key={l.id} className="lead-row" onClick={() => handleOpenLead(l.id)}>
                    <td className="company-cell">{l.company_name}</td>
                    <td>{l.contact_name || '—'}</td>
                    <td>
                      <span className={`badge badge-${l.segment.toLowerCase()}`}>{l.segment}</span>
                    </td>
                    <td>
                      <span className="stage-cell">{l.stage?.name || 'Prospect'}</span>
                    </td>
                    <td style={{ color: scoreColor, fontWeight: '700' }}>{l.score}</td>
                    <td style={{ fontWeight: '500' }}>{l.deal_value}k€</td>
                    <td>{l.owner ? l.owner.full_name : '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {new Date(l.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  Aucun lead ne correspond aux critères
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick modal fallback details */}
      {selectedLead && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          header={
            <>
              <div className="modal-title">{selectedLead.company_name}</div>
              <div className="modal-sub">
                {selectedLead.contact_name || '—'}
                {selectedLead.email ? ` · ${selectedLead.email}` : ''}
              </div>
              <div className="modal-badges-row" style={{ marginTop: '8px' }}>
                <span className={`badge badge-${selectedLead.segment.toLowerCase()}`}>{selectedLead.segment}</span>
                <span className="stage-pill">{selectedLead.stage?.name}</span>
                <span style={{ fontSize: '12px', fontWeight: '500', color: selectedLead.score >= 80 ? 'var(--green)' : selectedLead.score >= 60 ? 'var(--gold)' : 'var(--red)' }}>
                  Score : {selectedLead.score}/100
                </span>
              </div>
            </>
          }
        >
          <div className="mtab-panel on" style={{ padding: '20px' }}>
            <div className="detail-row">
              <span className="detail-key">Email</span>
              <span className="detail-val">{selectedLead.email || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Téléphone</span>
              <span className="detail-val">{selectedLead.phone || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">LinkedIn</span>
              <span className="detail-val">{selectedLead.linkedin_url || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Valeur</span>
              <span className="detail-val">{selectedLead.deal_value}k€</span>
            </div>
            {selectedLead.note && (
              <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="detail-key" style={{ marginBottom: '4px' }}>Note</span>
                <span className="detail-val" style={{ textAlign: 'left', opacity: '0.8' }}>{selectedLead.note}</span>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ borderTop: '0.5px solid var(--border)', padding: '14px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-sm" onClick={() => setModalOpen(false)}>Fermer</button>
          </div>
        </Modal>
      )}
    </div>
  );
};
