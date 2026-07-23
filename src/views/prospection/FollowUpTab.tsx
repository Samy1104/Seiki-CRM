import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { prospectionService } from '../../services/prospectionService';
import { Button } from '../../components/ui/Button';

interface FollowUpTabProps {
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

export const FollowUpTab: React.FC<FollowUpTabProps> = ({ showToast }) => {
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof prospectionService.getFollowUpCandidates>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    prospectionService
      .getFollowUpCandidates()
      .then((data) => {
        if (!cancelled) setCandidates(data);
      })
      .catch(() => {
        if (!cancelled) showToast('Erreur chargement relances', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm font-ui text-ink-soft flex items-center justify-center gap-2">
        <Loader2 size={18} strokeWidth={2} className="animate-spin text-[#D4C4A8]" /> Analyse des relances...
      </div>
    );
  }

  const actionLabels = {
    follow_up_1: { label: '1ère relance', color: '#D4C4A8' },
    follow_up_2: { label: '2ème relance', color: '#64748B' },
    archive: { label: 'À archiver', color: '#6B6B64' },
    wait: { label: 'Attente', color: '#9A9A93' },
  };

  const handleGenerateFollowUp = async (candidate: (typeof candidates)[number]) => {
    if (candidate.recommendedAction !== 'follow_up_1' && candidate.recommendedAction !== 'follow_up_2') return;
    const step = candidate.recommendedAction === 'follow_up_1' ? 'relance_1' : 'relance_2';
    try {
      await prospectionService.createFollowUpDraft(candidate.lead, step);
      showToast(`Relance générée pour ${candidate.lead.contact_name}`, 'success');
      setCandidates((prev) => prev.filter((c) => c.lead.id !== candidate.lead.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur génération relance', 'error');
    }
  };

  return (
    <div className="space-y-4 font-ui">
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-line-strong">
        <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
          Relances intelligentes
        </h2>
        <span className="text-xs text-ink-soft bg-surface border border-line-strong px-2.5 py-1 rounded-control flex items-center gap-1.5">
          <AlertCircle size={13} strokeWidth={2} className="text-[#D4C4A8]" /> Calculé sur les 30 derniers jours
        </span>
      </div>

      {candidates.length === 0 ? (
        <div className="p-8 rounded-surface border border-line-strong bg-surface text-center space-y-2">
          <Check size={32} strokeWidth={2} className="mx-auto text-success opacity-80" />
          <p className="text-sm text-ink-soft max-w-md mx-auto">
            Aucune relance nécessaire — tous les leads sont à jour !
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate) => {
            const { lead, daysSinceLastEmail, hasOpened, followUpCount, recommendedAction } = candidate;
            const action = actionLabels[recommendedAction];
            return (
              <div
                key={lead.id}
                className="p-4 rounded-surface border border-line-strong bg-surface flex flex-wrap items-center justify-between gap-4 shadow-hover"
              >
                <div className="min-w-[180px]">
                  <strong className="text-sm font-semibold text-ink block">{lead.contact_name}</strong>
                  <span className="text-xs text-ink-soft">{lead.company_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-soft flex-wrap">
                  <span className="bg-base px-2.5 py-1 rounded-control border border-line-strong">{daysSinceLastEmail}j sans réponse</span>
                  {hasOpened && <span className="text-success font-medium">✓ A ouvert</span>}
                  {followUpCount > 0 && <span>{followUpCount} relance(s)</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-control border"
                    style={{ color: action.color, borderColor: `${action.color}40`, backgroundColor: `${action.color}15` }}
                  >
                    {action.label}
                  </span>
                  {(recommendedAction === 'follow_up_1' || recommendedAction === 'follow_up_2') && (
                    <Button variant="secondary" size="sm" onClick={() => handleGenerateFollowUp(candidate)}>
                      Générer la relance
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
