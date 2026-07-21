import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Loader } from 'lucide-react';
import { prospectionService } from '../../services/prospectionService';

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
      <div className="pros-loading">
        <Loader size={20} className="spin" /> Analyse des relances...
      </div>
    );
  }

  const actionLabels = {
    follow_up_1: { label: '1ère relance', color: 'var(--color-amber)' },
    follow_up_2: { label: '2ème relance', color: 'var(--color-chart-neutral)' },
    archive: { label: 'À archiver', color: 'var(--text-muted)' },
    wait: { label: 'Attente', color: 'var(--text-secondary)' },
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
    <div>
      <div className="pros-section-header">
        <h2>Relances intelligentes</h2>
        <span className="pros-info-badge">
          <AlertCircle size={12} /> Calculé sur les 30 derniers jours
        </span>
      </div>

      {candidates.length === 0 ? (
        <div className="pros-empty">
          <Check size={32} style={{ color: 'var(--green)', opacity: 0.6 }} />
          <p>Aucune relance nécessaire — tous les leads sont à jour !</p>
        </div>
      ) : (
        <div className="followup-list">
          {candidates.map((candidate) => {
            const { lead, daysSinceLastEmail, hasOpened, followUpCount, recommendedAction } = candidate;
            const action = actionLabels[recommendedAction];
            return (
              <div key={lead.id} className="followup-row">
                <div className="followup-info">
                  <strong>{lead.contact_name}</strong>
                  <span className="followup-company">{lead.company_name}</span>
                </div>
                <div className="followup-stats">
                  <span className="followup-days">{daysSinceLastEmail}j sans réponse</span>
                  {hasOpened && <span className="followup-opened">✓ A ouvert</span>}
                  {followUpCount > 0 && <span className="followup-count">{followUpCount} relance(s)</span>}
                </div>
                <span
                  className="followup-action-badge"
                  style={{ color: action.color, borderColor: action.color }}
                >
                  {action.label}
                </span>
                {(recommendedAction === 'follow_up_1' || recommendedAction === 'follow_up_2') && (
                  <button className="btn-ghost-sm" onClick={() => handleGenerateFollowUp(candidate)}>
                    Générer la relance
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
