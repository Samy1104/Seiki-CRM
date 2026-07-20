import { useEffect, useState } from 'react';
import { leadsService } from '../services/leadsService';
import type { Lead, LeadScoreDetail } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { FileText, Award } from 'lucide-react';
import { EmailGenerator } from '../components/EmailGenerator';
import { Button } from '../components/ui/Button';
import { Field, inputClass } from '../components/ui/Field';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../components/ui/Select';

const CRITERIA = [
  {
    id: 'taille',
    label: 'Taille entreprise',
    max: 15,
    opts: [
      { l: '< 50 sal.', v: 3 },
      { l: '50–500', v: 8 },
      { l: '500–5 000', v: 13 },
      { l: '> 5 000', v: 15 }
    ]
  },
  {
    id: 'budget',
    label: 'Budget mobilité / an',
    max: 20,
    opts: [
      { l: '< 20k€', v: 4 },
      { l: '20–100k€', v: 10 },
      { l: '100–500k€', v: 16 },
      { l: '> 500k€', v: 20 }
    ]
  },
  {
    id: 'urgence',
    label: 'Urgence du besoin',
    max: 15,
    opts: [
      { l: 'Aucune', v: 2 },
      { l: '6 mois+', v: 7 },
      { l: '3 mois', v: 12 },
      { l: 'Immédiate', v: 15 }
    ]
  },
  {
    id: 'decideur',
    label: 'Accès décideur',
    max: 15,
    opts: [
      { l: 'Inconnu', v: 0 },
      { l: 'Identifié', v: 6 },
      { l: 'Contacté', v: 10 },
      { l: 'En discussion', v: 15 }
    ]
  },
  {
    id: 'fit',
    label: 'Fit offre Seiki',
    max: 20,
    opts: [
      { l: 'Faible', v: 2 },
      { l: 'Partiel', v: 8 },
      { l: 'Fort', v: 14 },
      { l: 'Parfait', v: 20 }
    ]
  },
  {
    id: 'concurrence',
    label: 'Concurrence',
    max: 15,
    opts: [
      { l: 'Forte', v: 3 },
      { l: 'Présente', v: 8 },
      { l: 'Faible', v: 13 },
      { l: 'Aucune', v: 15 }
    ]
  }
];

interface AddLeadProps {
  setView: (view: string) => void;
}

const scoreClass = (value: number, max: number) => {
  if (value <= 0) return 'text-ink-faint';
  if (value >= max * 0.8) return 'text-success';
  if (value >= max * 0.5) return 'text-amber';
  return 'text-danger';
};

export const AddLead: React.FC<AddLeadProps> = ({ setView }) => {
  const { showToast } = useToast();
  const [stages, setStages] = useState<PipelineStage[]>([]);

  // Form State
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
    note: ''
  });

  // Score state
  const [scores, setScores] = useState<Record<string, { value: number; label: string }>>({
    taille: { value: 0, label: '' },
    budget: { value: 0, label: '' },
    urgence: { value: 0, label: '' },
    decideur: { value: 0, label: '' },
    fit: { value: 0, label: '' },
    concurrence: { value: 0, label: '' }
  });

  // Custom fields state
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);

  const addCustomField = () => setCustomFields((prev) => [...prev, { key: '', value: '' }]);
  const updateCustomField = (index: number, field: 'key' | 'value', val: string) =>
    setCustomFields((prev) => prev.map((cf, i) => (i === index ? { ...cf, [field]: val } : cf)));
  const removeCustomField = (index: number) =>
    setCustomFields((prev) => prev.filter((_, i) => i !== index));

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
    setScores(prev => ({
      ...prev,
      [criterionId]: { value, label }
    }));
  };

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
      note: ''
    });
    setScores({
      taille: { value: 0, label: '' },
      budget: { value: 0, label: '' },
      urgence: { value: 0, label: '' },
      decideur: { value: 0, label: '' },
      fit: { value: 0, label: '' },
      concurrence: { value: 0, label: '' }
    });
    setCustomFields([]);
  };

  const calculateTotalScore = () => {
    return Object.values(scores).reduce((acc, curr) => acc + curr.value, 0);
  };

  const totalScore = calculateTotalScore();

  const getRecommendation = () => {
    if (totalScore >= 80) return { text: '→ Priorité haute — entrer en pipeline immédiatement', className: 'text-success' };
    if (totalScore >= 60) return { text: '→ Qualifié — intégrer au pipeline sous 48h', className: 'text-amber' };
    if (totalScore >= 40) return { text: '→ Potentiel — nurturing à 30 jours', className: 'text-chart-neutral' };
    if (totalScore > 0) return { text: '→ Hors cible — archiver', className: 'text-danger' };
    return { text: 'Remplissez les critères de scoring', className: 'text-ink-faint' };
  };

  const recommendation = getRecommendation();

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

    try {
      // Determine initial stage
      let initialStageId = form.stage_id;
      if (initialStageId === 'auto') {
        const stageName = totalScore >= 60 ? 'Qualification' : 'Prospect';
        const matched = stages.find(s => s.name === stageName);
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
        )
      };

      // Prepare score list
      const scorePayloads = Object.entries(scores)
        .filter(([_, data]) => data.value > 0)
        .map(([criterion, data]) => {
          const maxVal = CRITERIA.find(c => c.id === criterion)?.max || 15;
          return {
            criterion: criterion as LeadScoreDetail['criterion'],
            value: data.value,
            max_value: maxVal,
            label_selected: data.label,
            scored_by: 'manual'
          };
        });

      await leadsService.createLead(leadPayload, scorePayloads);

      showToast('Lead ajouté au pipeline ✓');
      setView('pipeline');
    } catch (err) {
      console.error('Error creating lead:', err);
      showToast('Erreur lors de la création du lead', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="font-display text-xl font-bold text-ink">Ajouter un lead</div>
        <div className="mt-0.5 text-xs text-ink-soft">Scorer avant d'entrer dans le pipeline</div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left Column: Form */}
        <div className="rounded-surface border border-line bg-elevated p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <FileText size={14} className="text-amber" />
            Informations du lead
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Société *">
                <input
                  type="text"
                  placeholder="ex : LVMH"
                  value={form.company_name}
                  onChange={e => setForm({ ...form, company_name: e.target.value })}
                  required
                  className={inputClass}
                />
              </Field>

              <Field label="Contact">
                <input
                  type="text"
                  placeholder="ex : Dir. Mobilité"
                  value={form.contact_name}
                  onChange={e => setForm({ ...form, contact_name: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  placeholder="contact@société.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Téléphone">
                <input
                  type="text"
                  placeholder="ex : +33 6 00 00 00 00"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="LinkedIn">
                <input
                  type="url"
                  placeholder="linkedin.com/in/..."
                  value={form.linkedin_url}
                  onChange={e => setForm({ ...form, linkedin_url: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Site Web">
                <input
                  type="url"
                  placeholder="www.entreprise.com"
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Segment *">
                <Select
                  value={form.segment}
                  onValueChange={val => setForm({ ...form, segment: val as Lead['segment'] })}
                >
                  <SelectTrigger><SelectValue placeholder="— Choisir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Choisir</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Instit">Instit</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Valeur (k€)">
                <input
                  type="number"
                  placeholder="ex : 45"
                  value={form.deal_value}
                  onChange={e => setForm({ ...form, deal_value: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Source">
                <Select
                  value={form.source}
                  onValueChange={val => setForm({ ...form, source: val })}
                >
                  <SelectTrigger><SelectValue placeholder="LinkedIn" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    <SelectItem value="Événement">Événement</SelectItem>
                    <SelectItem value="Réseau">Réseau</SelectItem>
                    <SelectItem value="AndZup">AndZup</SelectItem>
                    <SelectItem value="Inbound">Inbound</SelectItem>
                    <SelectItem value="Chrome Extension">Chrome Extension</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Étape initiale">
                <Select
                  value={form.stage_id}
                  onValueChange={val => setForm({ ...form, stage_id: val })}
                >
                  <SelectTrigger><SelectValue placeholder="Auto (selon score)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (selon score)</SelectItem>
                    {stages.map(st => (
                      <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Note" className="sm:col-span-2">
                <textarea
                  placeholder="Contexte, déclencheur, informations utiles..."
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  rows={3}
                  className={inputClass}
                />
              </Field>

              <Field label="Champs personnalisés (utilisables dans les templates via {{custom.<clé>}})" className="sm:col-span-2">
                {customFields.map((cf, i) => (
                  <div key={i} className="mb-1.5 flex gap-2">
                    <input
                      type="text"
                      placeholder="clé (ex: evenement)"
                      value={cf.key}
                      onChange={(e) => updateCustomField(i, 'key', e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="text"
                      placeholder="valeur (ex: Salon VivaTech)"
                      value={cf.value}
                      onChange={(e) => updateCustomField(i, 'value', e.target.value)}
                      className={`${inputClass} flex-[2]`}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomField(i)}>×</Button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={addCustomField}>+ Ajouter un champ</Button>
              </Field>
            </div>

            <div className="mt-5 flex gap-2.5">
              <Button type="submit" variant="primary" className="flex-1">Ajouter au pipeline</Button>
              <Button type="button" variant="secondary" onClick={handleReset}>Réinitialiser</Button>
            </div>
          </form>

          <EmailGenerator
            contactName={form.contact_name}
            website={form.website}
            onSelectEmail={email => setForm(prev => ({ ...prev, email }))}
          />
        </div>

        {/* Right Column: Scoring ICP */}
        <div className="rounded-surface border border-line bg-elevated p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <Award size={14} className="text-amber" />
            Scoring ICP — 6 critères
          </div>

          <div className="flex flex-col gap-2.5">
            {CRITERIA.map(c => (
              <div key={c.id} className="flex items-center gap-2.5">
                <span className="w-32 flex-shrink-0 text-xs font-medium text-ink-soft">{c.label}</span>
                <span className="w-8 flex-shrink-0 text-[10px] text-ink-faint">/{c.max}</span>
                <Select
                  value={String(scores[c.id].value)}
                  onValueChange={valStr => {
                    const val = parseInt(valStr) || 0;
                    const opt = c.opts.find(o => o.v === val);
                    handleScoreChange(c.id, val, opt ? opt.l : '');
                  }}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="— Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">— Sélectionner</SelectItem>
                    {c.opts.map(o => (
                      <SelectItem key={o.v} value={String(o.v)}>{o.l} ({o.v}pts)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className={`w-12 flex-shrink-0 text-right text-xs font-semibold tabular-nums ${scoreClass(scores[c.id].value, c.max)}`}>
                  {scores[c.id].value > 0 ? `${scores[c.id].value}pts` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="mb-0.5 text-[11px] text-ink-faint">Score ICP</div>
                <div className={`font-display text-3xl font-bold tabular-nums ${scoreClass(totalScore, 100)}`}>
                  {totalScore}
                </div>
              </div>
              <div className="text-[11px] text-ink-faint">/100 pts</div>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-hover">
              <div
                className={`h-full transition-all ${totalScore >= 80 ? 'bg-success' : totalScore >= 60 ? 'bg-amber' : totalScore > 0 ? 'bg-danger' : 'bg-transparent'}`}
                style={{ width: `${totalScore}%` }}
              />
            </div>

            <div className={`mt-3 text-xs font-medium ${recommendation.className}`}>
              {recommendation.text}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
