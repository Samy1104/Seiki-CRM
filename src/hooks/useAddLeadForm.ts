import { useState, useEffect } from 'react';
import { leadsService, type LeadScoreDetail } from '../services/leadsService';
import { settingsService, type PipelineStage } from '../services/settingsService';
import { useToast } from '../context/ToastContext';

export const CRITERIA = [
  {
    id: 'taille',
    label: 'Taille entreprise',
    max: 15,
    opts: [
      { l: '< 50 sal.', v: 3 },
      { l: '50–500', v: 8 },
      { l: '500–5 000', v: 13 },
      { l: '> 5 000', v: 15 },
    ],
  },
  {
    id: 'budget',
    label: 'Budget mobilité / an',
    max: 20,
    opts: [
      { l: '< 20k€', v: 4 },
      { l: '20–100k€', v: 10 },
      { l: '100–500k€', v: 16 },
      { l: '> 500k€', v: 20 },
    ],
  },
  {
    id: 'urgence',
    label: 'Urgence du besoin',
    max: 15,
    opts: [
      { l: 'Aucune', v: 2 },
      { l: '6 mois+', v: 7 },
      { l: '3 mois', v: 12 },
      { l: 'Immédiate', v: 15 },
    ],
  },
  {
    id: 'decideur',
    label: 'Accès décideur',
    max: 15,
    opts: [
      { l: 'Inconnu', v: 0 },
      { l: 'Identifié', v: 6 },
      { l: 'Contacté', v: 10 },
      { l: 'En discussion', v: 15 },
    ],
  },
  {
    id: 'fit',
    label: 'Fit offre Seiki',
    max: 20,
    opts: [
      { l: 'Faible', v: 2 },
      { l: 'Partiel', v: 8 },
      { l: 'Fort', v: 14 },
      { l: 'Parfait', v: 20 },
    ],
  },
  {
    id: 'concurrence',
    label: 'Concurrence',
    max: 15,
    opts: [
      { l: 'Forte', v: 3 },
      { l: 'Présente', v: 8 },
      { l: 'Faible', v: 13 },
      { l: 'Aucune', v: 15 },
    ],
  },
];

export function useAddLeadForm(setView: (view: string) => void) {
  const { showToast } = useToast();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    linkedin_url: '',
    phone: '',
    website: '',
    segment: '' as 'Media' | 'Retail' | 'Instit' | '',
    deal_value: '',
    source: 'LinkedIn',
    stage_id: 'auto',
    note: '',
  });

  const [scores, setScores] = useState<Record<string, { value: number; label: string }>>({
    taille: { value: 0, label: '' },
    budget: { value: 0, label: '' },
    urgence: { value: 0, label: '' },
    decideur: { value: 0, label: '' },
    fit: { value: 0, label: '' },
    concurrence: { value: 0, label: '' },
  });

  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);

  useEffect(() => {
    const fetchStages = async () => {
      try {
        const fetchedStages = await settingsService.getPipelineStages();
        setStages(fetchedStages);
      } catch (err) {
        console.error('Error fetching stages:', err);
      }
    };
    fetchStages();
  }, []);

  const handleScoreChange = (criterionId: string, value: number, label: string) => {
    setScores((prev) => ({
      ...prev,
      [criterionId]: { value, label },
    }));
  };

  const addCustomField = () => setCustomFields((prev) => [...prev, { key: '', value: '' }]);
  const updateCustomField = (index: number, field: 'key' | 'value', val: string) =>
    setCustomFields((prev) => prev.map((cf, i) => (i === index ? { ...cf, [field]: val } : cf)));
  const removeCustomField = (index: number) =>
    setCustomFields((prev) => prev.filter((_, i) => i !== index));

  const handleReset = () => {
    setForm({
      company_name: '',
      contact_name: '',
      email: '',
      linkedin_url: '',
      phone: '',
      website: '',
      segment: '',
      deal_value: '',
      source: 'LinkedIn',
      stage_id: 'auto',
      note: '',
    });
    setScores({
      taille: { value: 0, label: '' },
      budget: { value: 0, label: '' },
      urgence: { value: 0, label: '' },
      decideur: { value: 0, label: '' },
      fit: { value: 0, label: '' },
      concurrence: { value: 0, label: '' },
    });
    setCustomFields([]);
  };

  const totalScore = Object.values(scores).reduce((acc, curr) => acc + curr.value, 0);

  const getRecommendation = () => {
    if (totalScore >= 80) return { text: '→ Priorité haute — entrer en pipeline immédiatement', className: 'text-success' };
    if (totalScore >= 60) return { text: '→ Qualifié — intégrer au pipeline sous 48h', className: 'text-amber' };
    if (totalScore >= 40) return { text: '→ Potentiel — nurturing à 30 jours', className: 'text-chart-neutral' };
    if (totalScore > 0) return { text: '→ Hors cible — archiver', className: 'text-danger' };
    return { text: 'Remplissez les critères de scoring', className: 'text-ink-faint' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.company_name.trim()) {
      showToast('Nom de la société requis', 'error');
      return;
    }
    if (!form.segment) {
      showToast('Veuillez sélectionner un segment', 'error');
      return;
    }

    if (stages.length === 0) {
      showToast('Impossible de déterminer l\'étape du pipeline (aucune étape chargée). Réessayez.', 'error');
      return;
    }

    setLoading(true);
    try {
      let initialStageId = form.stage_id;
      if (initialStageId === 'auto') {
        const stageName = totalScore >= 60 ? 'Qualification' : 'Prospect';
        const matched = stages.find((s) => s.name === stageName);
        initialStageId = matched ? matched.id : stages[0].id;
      }

      const leadPayload = {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim() || '—',
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        website: form.website.trim() || null,
        segment: form.segment,
        deal_value: parseInt(form.deal_value) || 0,
        source: form.source,
        stage_id: initialStageId,
        note: form.note.trim() || null,
        owner_id: null,
        email_verified: false,
        domain: null,
        custom_fields: Object.fromEntries(
          customFields.filter((cf) => cf.key.trim()).map((cf) => [cf.key.trim(), cf.value])
        ),
      };

      const scorePayloads = Object.entries(scores)
        .filter(([_, data]) => data.value > 0)
        .map(([criterion, data]) => {
          const maxVal = CRITERIA.find((c) => c.id === criterion)?.max || 15;
          return {
            criterion: criterion as LeadScoreDetail['criterion'],
            value: data.value,
            max_value: maxVal,
            notes: data.label,
          };
        });

      await leadsService.createLead(leadPayload, scorePayloads as any);
      showToast('Lead ajouté au pipeline ✓');
      setView('pipeline');
    } catch (err) {
      console.error('Error creating lead:', err);
      showToast('Erreur lors de la création du lead', 'error');
    } finally {
      setLoading(false);
    }
  };

  return {
    form,
    setForm,
    scores,
    handleScoreChange,
    customFields,
    addCustomField,
    updateCustomField,
    removeCustomField,
    stages,
    loading,
    totalScore,
    recommendation: getRecommendation(),
    handleReset,
    handleSubmit,
  };
}
