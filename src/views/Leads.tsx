import React, { useEffect, useMemo, useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { SlaLimits } from '../services/settingsService';
import { tasksService } from '../services/tasksService';
import { useToast } from '../context/ToastContext';
import { Search, Filter, Layers, Plus, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { AccentButton } from '../components/ui/AccentButton';
import { SegmentedToggle } from '../components/ui/SegmentedToggle';
import { Badge } from '../components/ui/Badge';
import { confirmAction } from '../utils/confirmAction';
import { useCachedResource } from '../hooks/useCachedResource';
import { LeadDetailModal } from './pipeline/LeadDetailModal';

interface LeadsProps {
  setView: (view: string) => void;
}

const DEFAULT_SLA_LIMITS: SlaLimits = { Media: 5, Retail: 7, Instit: 14 };
const scoreClass = (score: number) => (score >= 80 ? 'text-success' : score >= 60 ? 'text-amber' : 'text-danger');

export const Leads: React.FC<LeadsProps> = ({ setView }) => {
  const { showToast } = useToast();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState(''); // 'hot' (>=80), 'qualified' (60-79), 'nurturing' (<60)
  const [archiveFilter, setArchiveFilter] = useState<boolean>(false);

  // Modal State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'info' | 'edit'>('info');

  const onError = (err: unknown) => {
    console.error('Error loading leads data:', err);
    showToast('Erreur lors du chargement', 'error');
  };

  const leadsRes = useCachedResource(`leads:${archiveFilter}`, () => leadsService.getLeads(archiveFilter), [], { onError });
  const mergeProposalsRes = useCachedResource('mergeProposals', () => leadsService.getMergeProposals(), [], { onError });
  const stagesRes = useCachedResource('stages', () => settingsService.getPipelineStages(), [], { onError });
  const tasksRes = useCachedResource('tasks', () => tasksService.getTasks(), [], { onError });
  const slaLimitsRes = useCachedResource('slaLimits', () => settingsService.getSlaLimits(), DEFAULT_SLA_LIMITS, { onError });

  const leads = leadsRes.data;
  const mergeProposals = mergeProposalsRes.data;
  const stages = stagesRes.data;
  const tasks = tasksRes.data;
  const slaLimits = slaLimitsRes.data;

  const loading = leadsRes.loading || mergeProposalsRes.loading || stagesRes.loading || tasksRes.loading;

  const loadLeadsData = () => Promise.all([
    leadsRes.reload(),
    mergeProposalsRes.reload(),
    stagesRes.reload(),
    tasksRes.reload(),
  ]).then(() => {});

  const handleOpenLead = async (leadId: string, initialTab: 'info' | 'edit' = 'info') => {
    try {
      const leadDetails = await leadsService.getLeadById(leadId);
      setSelectedLead(leadDetails);
      setModalInitialTab(initialTab);
      setModalOpen(true);
    } catch (err) {
      console.error('Error loading lead details:', err);
      showToast('Erreur de chargement du lead', 'error');
    }
  };

  // Deep-link depuis d'autres pages (ex: bouton "Voir le lead" sur un
  // rendez-vous Calendly dans l'Agenda) — ouvre directement la fiche lead
  // visée par ?leadId=, même convention one-shot que les query params
  // ?calendly=/?gmail= (lu au montage, puis nettoyé de l'URL).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get('leadId');
    if (leadId) {
      handleOpenLead(leadId);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditLead = (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation();
    handleOpenLead(leadId, 'edit');
  };

  const handleDeleteLead = async (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation();
    if (confirmAction('Voulez-vous supprimer ce lead définitivement ?')) {
      try {
        await leadsService.deleteLead(leadId);
        showToast('Lead supprimé avec succès', 'success');
        loadLeadsData();
      } catch (err) {
        console.error('Error deleting lead:', err);
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  const handleToggleArchiveLead = async (e: React.MouseEvent, leadId: string, isCurrentlyArchived: boolean) => {
    e.stopPropagation();
    try {
      await leadsService.updateLead(
        leadId,
        { is_archived: !isCurrentlyArchived },
        { type: 'note', content: !isCurrentlyArchived ? 'Lead archivé' : 'Lead désarchivé' }
      );
      showToast(!isCurrentlyArchived ? 'Lead archivé avec succès' : 'Lead désarchivé avec succès');
      loadLeadsData();
    } catch (err) {
      console.error('Error toggling archive status:', err);
      showToast('Erreur lors de la modification', 'error');
    }
  };

  const handleMergeApprove = async (proposalId: string) => {
    if (confirmAction('Êtes-vous sûr de vouloir fusionner ces deux leads ? L\'historique et les tâches seront fusionnés.')) {
      try {
        await leadsService.resolveMergeProposal(proposalId, 'approved');
        showToast('Fusion effectuée avec succès !', 'success');
        loadLeadsData();
      } catch (err) {
        console.error('Lead merge error:', err);
        showToast('Erreur lors de la fusion', 'error');
      }
    }
  };

  const handleMergeReject = async (proposalId: string) => {
    try {
      await leadsService.resolveMergeProposal(proposalId, 'rejected');
      showToast('Proposition ignorée', 'info');
      loadLeadsData();
    } catch (err) {
      console.error('Lead merge error:', err);
      showToast('Erreur', 'error');
    }
  };

  type SortColumn = 'company_name' | 'contact_name' | 'segment' | 'stage' | 'score' | 'deal_value' | 'created_at';
  type SortDirection = 'asc' | 'desc';

  const [sortColumn, setSortColumn] = useState<SortColumn>('company_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(['score', 'deal_value', 'created_at'].includes(column) ? 'desc' : 'asc');
    }
  };

  // Filter & Sort Logic
  const filteredLeads = useMemo(() => {
    const list = leads.filter(l => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || (
        l.company_name.toLowerCase().includes(q) ||
        (l.contact_name && l.contact_name.toLowerCase().includes(q)) ||
        (l.note && l.note.toLowerCase().includes(q))
      );

      // Segment
      const matchesSegment = !segmentFilter || l.segment === segmentFilter;

      // Score
      let matchesScore = true;
      if (scoreFilter === 'hot') matchesScore = l.score >= 80;
      else if (scoreFilter === 'qualified') matchesScore = l.score >= 60 && l.score < 80;
      else if (scoreFilter === 'nurturing') matchesScore = l.score < 60;

      return matchesSearch && matchesSegment && matchesScore;
    });

    return list.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (sortColumn === 'company_name') {
        valA = a.company_name || '';
        valB = b.company_name || '';
      } else if (sortColumn === 'contact_name') {
        valA = a.contact_name || '';
        valB = b.contact_name || '';
      } else if (sortColumn === 'segment') {
        valA = a.segment || '';
        valB = b.segment || '';
      } else if (sortColumn === 'stage') {
        valA = a.stage?.position ?? 0;
        valB = b.stage?.position ?? 0;
      } else if (sortColumn === 'score') {
        valA = a.score ?? 0;
        valB = b.score ?? 0;
      } else if (sortColumn === 'deal_value') {
        valA = a.deal_value ?? 0;
        valB = b.deal_value ?? 0;
      } else if (sortColumn === 'created_at') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      let cmp = 0;
      if (typeof valA === 'string') {
        cmp = valA.localeCompare(valB as string, 'fr', { sensitivity: 'base' });
      } else {
        cmp = valA > (valB as number) ? 1 : valA < (valB as number) ? -1 : 0;
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [leads, searchQuery, segmentFilter, scoreFilter, sortColumn, sortDirection]);

  const renderSortHeader = (label: string, column: SortColumn) => {
    const isSorted = sortColumn === column;
    return (
      <th
        onClick={() => handleSort(column)}
        className="px-4 py-3 cursor-pointer select-none group transition-colors hover:bg-hover/60 hover:text-ink"
        title={`Trier par ${label}`}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isSorted && (
            <span className="text-[10px] text-[#D4C4A8] font-bold shrink-0">
              {sortDirection === 'asc' ? '▲' : '▼'}
            </span>
          )}
        </div>
      </th>
    );
  };

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
          <PageTitle>Tous les leads</PageTitle>
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
          <AccentButton icon={<Plus size={15} strokeWidth={2.5} />} onClick={() => setView('add')}>Nouveau lead</AccentButton>
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
          <input
            type="text"
            placeholder="Rechercher par société, contact, note..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-control border border-line-strong bg-base py-2 pl-3 pr-9 text-sm text-ink outline-none transition-colors focus:border-line-focus"
          />
          <Search size={14} className="pointer-events-none absolute right-3 text-ink-faint" />
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
        </div>
      </div>

      <div className="overflow-hidden rounded-surface border border-line">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-elevated text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">
              {renderSortHeader('Société', 'company_name')}
              {renderSortHeader('Contact', 'contact_name')}
              {renderSortHeader('Segment', 'segment')}
              {renderSortHeader('Étape', 'stage')}
              {renderSortHeader('Score ICP', 'score')}
              {renderSortHeader('Valeur', 'deal_value')}
              {renderSortHeader('Créé le', 'created_at')}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length > 0 ? (
              filteredLeads.map(l => (
                <tr
                  key={l.id}
                  onClick={() => handleOpenLead(l.id, 'info')}
                  className="cursor-pointer border-b border-line bg-surface transition-colors last:border-b-0 hover:bg-hover"
                >
                  <td className="px-4 py-3 font-semibold text-ink">{l.company_name}</td>
                  <td className="px-4 py-3 text-ink-soft">{l.contact_name || '—'}</td>
                  <td className="px-4 py-3"><Badge tone="neutral">{l.segment}</Badge></td>
                  <td className="px-4 py-3 text-ink-soft">{l.stage?.name || 'Prospect'}</td>
                  <td className={`px-4 py-3 font-bold tabular-nums ${scoreClass(l.score)}`}>{l.score}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-ink">{l.deal_value?.toLocaleString()} €</td>
                  <td className="px-4 py-3 text-[11px] text-ink-faint">
                    {new Date(l.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title={l.is_archived ? 'Désarchiver le lead' : 'Archiver le lead'}
                        onClick={(e) => handleToggleArchiveLead(e, l.id, l.is_archived)}
                        className="rounded-control p-1.5 text-ink-soft hover:bg-elevated hover:text-[#D4C4A8] transition-colors cursor-pointer"
                      >
                        {l.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      </button>
                      <button
                        type="button"
                        title="Modifier le lead"
                        onClick={(e) => handleEditLead(e, l.id)}
                        className="rounded-control p-1.5 text-ink-soft hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Supprimer le lead"
                        onClick={(e) => handleDeleteLead(e, l.id)}
                        className="rounded-control p-1.5 text-ink-soft hover:bg-elevated hover:text-danger transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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

      {modalOpen && selectedLead && (
        <LeadDetailModal
          key={selectedLead.id}
          lead={selectedLead}
          stages={stages}
          teamMembers={[]}
          tasks={tasks}
          slaLimits={slaLimits}
          showToast={showToast}
          onClose={() => setModalOpen(false)}
          onChanged={loadLeadsData}
          initialTab={modalInitialTab}
        />
      )}
    </div>
  );
};
