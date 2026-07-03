import { useEffect, useState } from 'react';
import { leadsService } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { PipelineStage } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { FileText, Award } from 'lucide-react';

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
  };

  const calculateTotalScore = () => {
    return Object.values(scores).reduce((acc, curr) => acc + curr.value, 0);
  };

  const totalScore = calculateTotalScore();

  const getRecommendation = () => {
    if (totalScore >= 80) return { text: '→ Priorité haute — entrer en pipeline immédiatement', color: 'var(--green)' };
    if (totalScore >= 60) return { text: '→ Qualifié — intégrer au pipeline sous 48h', color: 'var(--gold)' };
    if (totalScore >= 40) return { text: '→ Potentiel — nurturing à 30 jours', color: 'var(--instit-tc)' };
    if (totalScore > 0) return { text: '→ Hors cible — archiver', color: 'var(--red)' };
    return { text: 'Remplissez les critères de scoring', color: 'var(--text-muted)' };
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

    try {
      // Determine initial stage
      let initialStageId = form.stage_id;
      if (initialStageId === 'auto') {
        const stageName = totalScore >= 60 ? 'Qualification' : 'Prospect';
        const matched = stages.find(s => s.name === stageName);
        initialStageId = matched ? matched.id : stages[0]?.id;
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
        domain: null
      };

      // Prepare score list
      const scorePayloads = Object.entries(scores)
        .filter(([_, data]) => data.value > 0)
        .map(([criterion, data]) => {
          const maxVal = CRITERIA.find(c => c.id === criterion)?.max || 15;
          return {
            criterion: criterion as any,
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
    <div className="view-section on">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Ajouter un lead</div>
          <div className="page-sub">Scorer avant d'entrer dans le pipeline</div>
        </div>
      </div>

      <div className="two-col">
        {/* Left Column: Form */}
        <div className="card form-section" style={{ padding: '20px' }}>
          <div className="form-title">
            <FileText size={14} style={{ marginRight: '6px' }} />
            Informations du lead
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <div className="field-label">Société *</div>
                <input 
                  type="text" 
                  placeholder="ex : LVMH" 
                  value={form.company_name}
                  onChange={e => setForm({ ...form, company_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <div className="field-label">Contact</div>
                <input 
                  type="text" 
                  placeholder="ex : Dir. Mobilité" 
                  value={form.contact_name}
                  onChange={e => setForm({ ...form, contact_name: e.target.value })}
                />
              </div>

              <div className="form-field">
                <div className="field-label">Email</div>
                <input 
                  type="email" 
                  placeholder="contact@société.com" 
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="form-field">
                <div className="field-label">Téléphone</div>
                <input 
                  type="text" 
                  placeholder="ex : +33 6 00 00 00 00" 
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="form-field">
                <div className="field-label">LinkedIn</div>
                <input 
                  type="url" 
                  placeholder="linkedin.com/in/..." 
                  value={form.linkedin_url}
                  onChange={e => setForm({ ...form, linkedin_url: e.target.value })}
                />
              </div>

              <div className="form-field">
                <div className="field-label">Site Web</div>
                <input 
                  type="url" 
                  placeholder="www.entreprise.com" 
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                />
              </div>

              <div className="form-field">
                <div className="field-label">Segment *</div>
                <select 
                  value={form.segment}
                  onChange={e => setForm({ ...form, segment: e.target.value as any })}
                  required
                >
                  <option value="">— Choisir</option>
                  <option value="Media">Media</option>
                  <option value="Retail">Retail</option>
                  <option value="Instit">Instit</option>
                </select>
              </div>

              <div className="form-field">
                <div className="field-label">Valeur (k€)</div>
                <input 
                  type="number" 
                  placeholder="ex : 45" 
                  value={form.deal_value}
                  onChange={e => setForm({ ...form, deal_value: e.target.value })}
                />
              </div>

              <div className="form-field">
                <div className="field-label">Source</div>
                <select 
                  value={form.source}
                  onChange={e => setForm({ ...form, source: e.target.value })}
                >
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Événement">Événement</option>
                  <option value="Réseau">Réseau</option>
                  <option value="AndZup">AndZup</option>
                  <option value="Inbound">Inbound</option>
                  <option value="Chrome Extension">Chrome Extension</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div className="form-field">
                <div className="field-label">Étape initiale</div>
                <select 
                  value={form.stage_id}
                  onChange={e => setForm({ ...form, stage_id: e.target.value })}
                >
                  <option value="auto">Auto (selon score)</option>
                  {stages.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-field full">
                <div className="field-label">Note</div>
                <textarea 
                  placeholder="Contexte, déclencheur, informations utiles..." 
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="submit" className="btn btn-grad" style={{ flex: '1' }}>
                Ajouter au pipeline
              </button>
              <button type="button" className="btn" onClick={handleReset}>
                Réinitialiser
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Scoring ICP */}
        <div className="card form-section" style={{ padding: '20px' }}>
          <div className="form-title">
            <Award size={14} style={{ marginRight: '6px' }} />
            Scoring ICP — 6 critères
          </div>

          <div className="score-criteria-list">
            {CRITERIA.map(c => (
              <div key={c.id} className="crit-item">
                <span className="crit-name">{c.label}</span>
                <span className="crit-max">/{c.max}</span>
                <select 
                  className="crit-select"
                  value={scores[c.id].value}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    const opt = c.opts.find(o => o.v === val);
                    handleScoreChange(c.id, val, opt ? opt.l : '');
                  }}
                >
                  <option value="0">— Sélectionner</option>
                  {c.opts.map(o => (
                    <option key={o.v} value={o.v}>{o.l} ({o.v}pts)</option>
                  ))}
                </select>
                <span className="crit-pts" style={{ 
                  color: scores[c.id].value > 0 ? (scores[c.id].value >= c.max * 0.8 ? 'var(--green)' : scores[c.id].value >= c.max * 0.5 ? 'var(--gold)' : 'var(--red)') : 'var(--text-muted)' 
                }}>
                  {scores[c.id].value > 0 ? `${scores[c.id].value}pts` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="score-result" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Score ICP</div>
                <div className="score-big" style={{ color: totalScore >= 80 ? 'var(--green)' : totalScore >= 60 ? 'var(--gold)' : 'var(--red)' }}>
                  {totalScore}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>/100 pts</div>
            </div>
            
            <div className="score-bar-wrap">
              <div 
                className="score-bar" 
                style={{ 
                  width: `${totalScore}%`, 
                  background: totalScore >= 80 ? 'var(--green)' : totalScore >= 60 ? 'var(--gold)' : totalScore > 0 ? 'var(--red)' : 'var(--border)' 
                }}
              ></div>
            </div>

            <div className="score-recommendation" style={{ color: recommendation.color, fontWeight: '500' }}>
              {recommendation.text}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
