import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import type { DashboardTargets, CodirMeeting } from '../../services/settingsService';
import { useToast } from '../../context/ToastContext';
import { Target, Calendar, Plus, Save, Trash2 } from 'lucide-react';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';

export const DashboardTargetsSettings: React.FC = () => {
  const { showToast } = useToast();
  const [targets, setTargets] = useState<DashboardTargets>({
    target_ca: 100,
    target_leads_count: 20,
    target_win_rate: 20,
    target_prospection_positive: 10,
  });
  const [codirMeetings, setCodirMeetings] = useState<CodirMeeting[]>([]);
  const [deletingMeeting, setDeletingMeeting] = useState<CodirMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, d] = await Promise.all([
        settingsService.getDashboardTargets(),
        settingsService.getCodirHistory(),
      ]);
      setTargets(t);
      setCodirMeetings(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTargets = async () => {
    setSaving(true);
    try {
      await settingsService.updateDashboardTargets(targets);
      showToast('Objectifs sauvegardés avec succès !', 'success');
    } catch (err) {
      console.error('Error saving dashboard targets:', err);
      showToast('Erreur lors de la sauvegarde des objectifs', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTodayCodir = async () => {
    try {
      const updated = await settingsService.addCodirDate();
      setCodirMeetings(updated);
      showToast('Date de CODIR enregistrée !', 'success');
    } catch (err) {
      console.error('Error saving CODIR date:', err);
      showToast("Erreur lors de l'enregistrement du CODIR", 'error');
    }
  };

  const handleConfirmDeleteCodir = async () => {
    if (!deletingMeeting) return;
    try {
      const updated = await settingsService.deleteCodirMeeting(deletingMeeting.id);
      setCodirMeetings(updated);
      showToast('Réunion CODIR supprimée !', 'success');
    } catch (err) {
      console.error('Error deleting CODIR meeting:', err);
      showToast('Erreur lors de la suppression du CODIR', 'error');
    } finally {
      setDeletingMeeting(null);
    }
  };

  if (loading) return <div className="text-sm text-ink-soft">Chargement des paramètres Dashboard...</div>;

  return (
    <div className="space-y-6 bg-[#141414] border border-line rounded-2xl p-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-lg">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Objectifs Commercial & Dates CODIR</h3>
            <p className="text-xs text-ink-soft">Définissez vos objectifs cibles et enregistrez les dates de vos réunions CODIR</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Objectif Chiffre d'Affaires (€)</label>
          <input
            type="number"
            value={targets.target_ca}
            onChange={(e) => setTargets({ ...targets, target_ca: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-sm text-[#f2ede4]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Objectif Nouveaux Leads Qualifiés</label>
          <input
            type="number"
            value={targets.target_leads_count}
            onChange={(e) => setTargets({ ...targets, target_leads_count: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-sm text-[#f2ede4]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Objectif Taux de Conversion Win Rate (%)</label>
          <input
            type="number"
            value={targets.target_win_rate}
            onChange={(e) => setTargets({ ...targets, target_win_rate: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-sm text-[#f2ede4]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Objectif Réponses Positives Prospection</label>
          <input
            type="number"
            value={targets.target_prospection_positive}
            onChange={(e) => setTargets({ ...targets, target_prospection_positive: Number(e.target.value) })}
            className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-sm text-[#f2ede4]"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveTargets}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4C4A8] text-[#0d0d0d] font-bold text-xs rounded-lg hover:bg-[#e2d5bd] transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer les Objectifs'}
        </button>
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#f2ede4]">
            <Calendar className="w-4 h-4 text-[#D4C4A8]" />
            Historique des réunions CODIR ({codirMeetings.length})
          </div>
          <button
            onClick={handleAddTodayCodir}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e1e] border border-line text-xs font-medium text-[#D4C4A8] rounded-lg hover:bg-[#252525] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Enregistrer le CODIR d'aujourd'hui
          </button>
        </div>
        {codirMeetings.length === 0 ? (
          <p className="text-xs text-ink-faint italic">Aucune date enregistrée. Cliquez ci-dessus pour marquer votre premier CODIR.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {codirMeetings.map((meeting) => (
              <div key={meeting.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e1e1e] border border-line text-xs text-[#f2ede4] rounded-md font-mono">
                <span>{meeting.meeting_date.slice(0, 10)}</span>
                <button
                  type="button"
                  aria-label={`Supprimer le CODIR du ${meeting.meeting_date.slice(0, 10)}`}
                  onClick={() => setDeletingMeeting(meeting)}
                  className="text-ink-soft hover:text-rose-400 transition-colors cursor-pointer p-0.5 ml-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={deletingMeeting !== null}
        title="Supprimer la réunion CODIR"
        message={`Êtes-vous sûr de vouloir supprimer la réunion CODIR du ${deletingMeeting?.meeting_date.slice(0, 10)} ?`}
        onConfirm={handleConfirmDeleteCodir}
        onCancel={() => setDeletingMeeting(null)}
      />
    </div>
  );
};
