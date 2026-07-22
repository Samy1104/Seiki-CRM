import React, { useMemo, useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead, MergeProposal } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { TeamMember } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { Search, Filter, Layers } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { HeaderActionButton } from '../components/ui/HeaderActionButton';
import { SegmentedToggle } from '../components/ui/SegmentedToggle';
import { Badge } from '../components/ui/Badge';
import { confirmAction } from '../utils/confirmAction';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';

interface LeadsProps {
  setView: (view: string) => void;
}

const scoreClass = (score: number) => (score >= 80 ? 'text-success' : score >= 60 ? 'text-amber' : 'text-danger');

export const Leads: React.FC<LeadsProps> = ({ setView }) => {
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
        <div className="mt-3 text-ink-soft">Chargement des Leads...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="font-display text-3xl font-bold text-ink">Tous les leads</div>
        </div>

        <div className="flex items-center gap-4">
          <SegmentedToggle
            value={archiveFilter ? 'archived' : 'active'}
            onChange={(v) => setArchiveFilter(v === 'archived')}
            options={[
              { value: 'active', label: 'Actifs' },
              { value: 'archived', label: 'Archivés' },
            ]}
          />
          <HeaderActionButton onClick={() => setView('add')}>Nouveau lead</HeaderActionButton>
        </div>
      </div>

      {mergeProposals.length > 0 && !archiveFilter && (
        <div className="mb-6 rounded-surface border border-line-focus bg-amber-soft/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <Layers size={16} className="text-amber" />
            <span>{mergeProposals.length} proposition{mergeProposals.length > 1 ? 's' : ''} de fusion (doublons détectés par domaine email)</span>
          </div>
          <div className="flex flex-col gap-2">
            {mergeProposals.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-control border border-line bg-surface p-3">
                <div className="text-xs text-ink-soft">
                  <strong className="text-ink">{p.source_lead?.company_name}</strong> ({p.source_lead?.contact_name})
                  <span className="mx-2 text-ink-faint">⇄</span>
                  <strong className="text-ink">{p.target_lead?.company_name}</strong> ({p.target_lead?.contact_name})
                  <div className="mt-0.5 text-[10px] text-ink-faint">
                    Raison : Même nom de domaine email ({p.source_lead?.email?.split('@')[1]})
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-1.5">
                  <Button variant="primary" size="sm" onClick={() => handleMergeApprove(p.id)}>Fusionner</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleMergeReject(p.id)}>Ignorer</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-surface border border-line bg-elevated p-3">
        <div className="relative flex min-w-[240px] flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-ink-faint" />
          <input
            type="text"
            placeholder="Rechercher par société, contact, note..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-control border border-line-strong bg-base py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors focus:border-line-focus"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="flex-shrink-0 text-ink-faint" />
            <Select value={segmentFilter} onValueChange={val => setSegmentFilter(val)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Tous les segments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les segments</SelectItem>
                <SelectItem value="Media">Media</SelectItem>
                <SelectItem value="Retail">Retail</SelectItem>
                <SelectItem value="Instit">Instit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter size={12} className="flex-shrink-0 text-ink-faint" />
            <Select value={scoreFilter} onValueChange={val => setScoreFilter(val)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Tous les scores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les scores</SelectItem>
                <SelectItem value="hot">Chauds (≥ 80)</SelectItem>
                <SelectItem value="qualified">Qualifiés (60-79)</SelectItem>
                <SelectItem value="nurturing">Nurturing (&lt; 60)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter size={12} className="flex-shrink-0 text-ink-faint" />
            <Select value={ownerFilter} onValueChange={val => setOwnerFilter(val)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Tous les propriétaires" /></SelectTrigger>
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

      <div className="overflow-hidden rounded-surface border border-line">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-elevated text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-3">Société</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Étape</th>
              <th className="px-4 py-3">Score ICP</th>
              <th className="px-4 py-3">Valeur</th>
              <th className="px-4 py-3">Propriétaire</th>
              <th className="px-4 py-3">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length > 0 ? (
              filteredLeads.map(l => (
                <tr
                  key={l.id}
                  onClick={() => handleOpenLead(l.id)}
                  className="cursor-pointer border-b border-line bg-surface transition-colors last:border-b-0 hover:bg-hover"
                >
                  <td className="px-4 py-3 font-semibold text-ink">{l.company_name}</td>
                  <td className="px-4 py-3 text-ink-soft">{l.contact_name || '—'}</td>
                  <td className="px-4 py-3"><Badge tone="neutral">{l.segment}</Badge></td>
                  <td className="px-4 py-3 text-ink-soft">{l.stage?.name || 'Prospect'}</td>
                  <td className={`px-4 py-3 font-bold tabular-nums ${scoreClass(l.score)}`}>{l.score}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-ink">{l.deal_value}k€</td>
                  <td className="px-4 py-3 text-ink-soft">{l.owner ? l.owner.full_name : '—'}</td>
                  <td className="px-4 py-3 text-[11px] text-ink-faint">
                    {new Date(l.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-faint">
                  Aucun lead ne correspond aux critères
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedLead && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          header={
            <>
              <div className="font-display text-base font-bold text-ink">{selectedLead.company_name}</div>
              <div className="mt-0.5 text-xs text-ink-soft">
                {selectedLead.contact_name || '—'}
                {selectedLead.email ? ` · ${selectedLead.email}` : ''}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone="neutral">{selectedLead.segment}</Badge>
                <Badge tone="neutral">{selectedLead.stage?.name}</Badge>
                <span className={`text-xs font-semibold ${scoreClass(selectedLead.score)}`}>
                  Score : {selectedLead.score}/100
                </span>
              </div>
            </>
          }
        >
          <div className="flex flex-col gap-3 p-6">
            <div className="flex justify-between border-b border-line pb-3 text-sm">
              <span className="text-ink-soft">Email</span>
              <span className="text-ink">{selectedLead.email || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-3 text-sm">
              <span className="text-ink-soft">Téléphone</span>
              <span className="text-ink">{selectedLead.phone || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-3 text-sm">
              <span className="text-ink-soft">LinkedIn</span>
              <span className="text-ink">{selectedLead.linkedin_url || '—'}</span>
            </div>
            <div className="flex justify-between pb-1 text-sm">
              <span className="text-ink-soft">Valeur</span>
              <span className="font-semibold text-ink">{selectedLead.deal_value}k€</span>
            </div>
            {selectedLead.note && (
              <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
                <span className="text-ink-soft">Note</span>
                <span className="text-ink-soft">{selectedLead.note}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-line px-6 py-4">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Fermer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
