import React, { useState, useEffect } from 'react';
import { Send, Loader2, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import { emailsService } from '../../services/emailsService';
import { templatesService, type EmailTemplate } from '../../services/templatesService';
import type { Lead } from '../../services/leadsService';
import { AccentButton } from '../../components/ui/AccentButton';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface TestSendPanelProps {
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

// Objet minimal utilisé uniquement pour prévisualiser un template hors de
// tout lead réel (envoi de test) — templatesService.renderTemplate ne lit
// que ces champs, le cast est sûr même si le type Lead complet est plus riche.
const PLACEHOLDER_LEAD = {
  contact_name: 'Prénom Nom',
  company_name: 'Entreprise Test',
  poste: 'Poste',
  segment: 'Media',
  custom_fields: {},
} as unknown as Lead;

export const TestSendPanel: React.FC<TestSendPanelProps> = ({ showToast }) => {
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (expanded && templates.length === 0) {
      templatesService.getTemplates().then(setTemplates).catch(() => {});
    }
  }, [expanded, templates.length]);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const rendered = templatesService.renderTemplate(template, PLACEHOLDER_LEAD);
    setSubject(rendered.subject);
    setBody(rendered.body);
  };

  const handleSend = async () => {
    if (!toEmail || !subject || !body) {
      showToast('Adresse, sujet et corps sont requis', 'error');
      return;
    }
    setSending(true);
    try {
      const result = await emailsService.sendTestEmail(toEmail, subject, body);
      showToast(`Email de test envoyé à ${result.to}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi test', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-surface border border-line-strong bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-3 flex items-center justify-between gap-2 text-xs font-ui font-semibold text-ink-soft hover:text-ink transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <FlaskConical size={14} strokeWidth={2} className="text-[#D4C4A8]" />
          Envoyer un email de test
        </span>
        {expanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
      </button>

      {expanded && (
        <div className="p-4 border-t border-line-strong bg-base space-y-3 font-ui">
          <p className="text-[11px] text-ink-faint">
            Envoi direct via le compte Gmail connecté — hors file d'approbation/pacing, aucun lead requis. Pour tester la connexion et le rendu.
          </p>

          <Field label="Adresse destinataire">
            <input
              type="email"
              className={inputClass}
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="test@exemple.com"
            />
          </Field>

          <Field label="Template (optionnel — pré-remplit sujet/corps)">
            <select
              className={inputClass}
              value={templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              <option value="">— Choisir un template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.segment} / {t.step}</option>
              ))}
            </select>
          </Field>

          <Field label="Sujet">
            <input
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>

          <Field label="Corps">
            <textarea
              className={`${inputClass} resize-y`}
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>

          <AccentButton
            variant="primary"
            onClick={handleSend}
            disabled={sending}
            icon={sending ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Send size={14} strokeWidth={2} />}
          >
            {sending ? 'Envoi...' : 'Envoyer le test'}
          </AccentButton>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="ml-2">
            Fermer
          </Button>
        </div>
      )}
    </div>
  );
};
