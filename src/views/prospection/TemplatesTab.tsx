import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { templatesService, type EmailTemplate } from '../../services/templatesService';
import { leadsService, type Lead } from '../../services/leadsService';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';

const SEGMENTS: EmailTemplate['segment'][] = ['All', 'Media', 'Retail', 'Instit'];
const STEPS: { key: EmailTemplate['step']; label: string }[] = [
  { key: 'initial', label: '1er email' },
  { key: 'relance_1', label: 'Relance 1' },
  { key: 'relance_2', label: 'Relance 2' },
];
const VARIABLES: { value: string; label: string }[] = [
  { value: '{{contact_name}}', label: 'Contact' },
  { value: '{{company_name}}', label: 'Entreprise' },
  { value: '{{poste}}', label: 'Poste' },
  { value: '{{segment}}', label: 'Segment' },
];

interface TemplatesTabProps {
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

export const TemplatesTab: React.FC<TemplatesTabProps> = ({ showToast }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [segment, setSegment] = useState<EmailTemplate['segment']>('All');
  const [step, setStep] = useState<EmailTemplate['step']>('initial');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewLeadId, setPreviewLeadId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([templatesService.getTemplates(), leadsService.getLeads()]);
      setTemplates(t);
      setLeads(l);
    } catch {
      showToast('Erreur chargement des templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const existing = templates.find((t) => t.segment === segment && t.step === step);
    setSubject(existing?.subject || '');
    setBody((existing?.body || '').replace(/\\n/g, '\n'));
  }, [segment, step, templates]);

  const insertVariable = (variable: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      setBody((prev) => prev + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setBody((prev) => prev.slice(0, start) + variable + prev.slice(end));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await templatesService.upsertTemplate(segment, step, subject, body);
      showToast('Template sauvegardé ✓', 'success');
      load();
    } catch {
      showToast('Erreur sauvegarde template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewLead = leads.find((l) => l.id === previewLeadId);
  const preview = previewLead ? templatesService.renderTemplate({ subject, body }, previewLead) : null;

  if (loading) {
    return (
      <div className="py-12 text-center text-sm font-ui text-ink-soft flex items-center justify-center gap-2">
        <Loader2 size={18} strokeWidth={2} className="animate-spin text-[#D4C4A8]" /> Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6 rounded-surface border border-line-strong bg-surface shadow-hover font-ui">
      <div className="flex gap-4 flex-wrap">
        <Field label="Segment" className="flex-1 min-w-[200px]">
          <Select value={segment} onValueChange={(val) => setSegment(val as EmailTemplate['segment'])}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={segment} />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Étape" className="flex-1 min-w-[200px]">
          <Select value={step} onValueChange={(val) => setStep(val as EmailTemplate['step'])}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={step} />
            </SelectTrigger>
            <SelectContent>
              {STEPS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Sujet">
        <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>

      <Field label="Corps">
        <div className="flex gap-2 flex-wrap mb-2">
          {VARIABLES.map((v) => (
            <button
              key={v.value}
              type="button"
              className="text-xs px-2.5 py-1 rounded-control bg-base border border-line-strong text-ink-soft hover:text-ink hover:border-line-focus cursor-pointer transition-colors"
              onClick={() => insertVariable(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <textarea ref={bodyRef} className={`${inputClass} resize-y`} rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>

      <div className="pt-1">
        <AccentButton
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          icon={
            saving ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <Check size={14} strokeWidth={2.5} />
            )
          }
        >
          {saving ? 'Enregistrement...' : 'Sauvegarder'}
        </AccentButton>
      </div>

      <div className="pt-4 border-t border-line-strong">
        <Field label="Aperçu sur un lead">
          <Select value={previewLeadId} onValueChange={(val) => setPreviewLeadId(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="-- Choisir un lead --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">-- Choisir un lead --</SelectItem>
              {leads.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.contact_name} — {l.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {preview && (
          <div className="mt-3 p-4 rounded-control bg-base border border-line-strong">
            <div className="font-semibold text-ink text-sm">{preview.subject}</div>
            <div className="mt-2 text-xs text-ink-soft whitespace-pre-line leading-relaxed">{preview.body}</div>
          </div>
        )}
      </div>
    </div>
  );
};
