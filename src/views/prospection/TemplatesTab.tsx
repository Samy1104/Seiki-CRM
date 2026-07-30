import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { templatesService, type EmailTemplate } from '../../services/templatesService';
import { leadsService, type Lead } from '../../services/leadsService';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';
import { parseContactName } from '../../utils/contactUtils';

const SEGMENTS: EmailTemplate['segment'][] = ['Media', 'Instit', 'Retail'];
const STEPS: { key: EmailTemplate['step']; label: string }[] = [
  { key: 'initial', label: '1er email' },
  { key: 'relance_1', label: 'Relance 1' },
  { key: 'relance_2', label: 'Relance 2' },
];
const VARIABLES: { value: string; label: string }[] = [
  { value: '{{genre}}', label: 'Genre' },
  { value: '{{prenom}}', label: 'Prénom' },
  { value: '{{nom}}', label: 'Nom' },
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
  const [segment, setSegment] = useState<EmailTemplate['segment']>('Media');
  const [step, setStep] = useState<EmailTemplate['step']>('initial');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewLeadId, setPreviewLeadId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');

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
    if (activeField === 'subject') {
      const input = subjectRef.current;
      if (!input) {
        setSubject((prev) => prev + variable);
        return;
      }
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const nextVal = subject.slice(0, start) + variable + subject.slice(end);
      setSubject(nextVal);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      const textarea = bodyRef.current;
      if (!textarea) {
        setBody((prev) => prev + variable);
        return;
      }
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const nextVal = body.slice(0, start) + variable + body.slice(end);
      setBody(nextVal);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
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

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) =>
      (a.company_name || '').localeCompare(b.company_name || '', undefined, { sensitivity: 'base' })
    );
  }, [leads]);

  const formatLeadLabel = (l: Lead) => {
    const { prenom, nom } = parseContactName(l.contact_name);
    const contactStr = [nom, prenom].filter(Boolean).join(' ') || l.contact_name || '';
    return contactStr ? `${l.company_name} - ${contactStr}` : l.company_name;
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
    <div className="space-y-3 p-4 rounded-surface border border-line-strong bg-surface shadow-hover font-ui flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Header bar: Segment, Étape, Variables, Sauvegarder */}
      <div className="flex items-end justify-between gap-3 flex-wrap border-b border-line-strong pb-2.5 shrink-0">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <div className="w-36 shrink-0">
            <Field label="Segment">
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
          </div>

          <div className="w-36 shrink-0">
            <Field label="Étape">
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

          <div className="flex-1 min-w-[200px]">
            <Field label="Variables">
              <div className="flex gap-1.5 flex-wrap items-center pt-0.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className="text-xs px-2 py-1 rounded-control bg-base border border-line-strong text-ink-soft hover:text-ink hover:border-line-focus cursor-pointer transition-colors"
                    onClick={() => insertVariable(v.value)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div className="shrink-0">
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
      </div>

      <div className="shrink-0">
        <Field label="Sujet">
          <input
            ref={subjectRef}
            className={inputClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setActiveField('subject')}
          />
        </Field>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <Field label="Corps" className="h-full flex flex-col min-h-0">
          <textarea
            ref={bodyRef}
            className={`${inputClass} flex-1 min-h-[140px] resize-none overflow-y-auto`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setActiveField('body')}
          />
        </Field>
      </div>

      <div className="pt-3 border-t border-line-strong shrink-0">
        <Field label="Aperçu sur un lead">
          <Select value={previewLeadId} onValueChange={(val) => setPreviewLeadId(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="-- Choisir un lead --" />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem value="">-- Choisir un lead --</SelectItem>
              {sortedLeads.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {formatLeadLabel(l)}
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
