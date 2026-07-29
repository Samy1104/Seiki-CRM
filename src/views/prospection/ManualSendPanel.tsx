import React, { useState, useEffect } from 'react';
import { Send, Loader2, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { emailsService } from '../../services/emailsService';
import { templatesService, type EmailTemplate } from '../../services/templatesService';
import type { Lead } from '../../services/leadsService';
import { AccentButton } from '../../components/ui/AccentButton';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';

interface ManualSendPanelProps {
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

// Objet minimal utilisé pour prévisualiser un template en envoi manuel
const PLACEHOLDER_LEAD = {
  contact_name: 'Prénom Nom',
  company_name: 'Entreprise',
  poste: 'Poste',
  segment: 'Media',
  custom_fields: {},
} as unknown as Lead;

const TEST_SEGMENTS: ('Media' | 'Retail' | 'Instit')[] = ['Media', 'Retail', 'Instit'];

const DEFAULT_TEMPLATES: Record<'Media' | 'Retail' | 'Instit', { subject: string; body: string }> = {
  Media: {
    subject: "Accompagnement Media — {{company_name}}",
    body: `Bonjour {{contact_name}},

Je me permets de vous contacter au sujet des enjeux media de {{company_name}}.

Chez Seiki, nous accompagnons les acteurs du secteur Media pour optimiser leur stratégie et maximiser leur impact.

Auriez-vous 15 minutes la semaine prochaine pour un rapide échange ?

Bien cordialement,
Jaafar EL ALAMY`,
  },
  Retail: {
    subject: "Performance & Stratégie Retail — {{company_name}}",
    body: `Bonjour {{contact_name}},

Je vous contacte suite à nos récents projets auprès des acteurs majeurs du Retail.

Nous aidons les enseignes comme {{company_name}} à accélérer leur croissance et transformer l'expérience client.

Seriez-vous disponible pour un court échange téléphonique ces prochains jours ?

Bien cordialement,
Jaafar EL ALAMY`,
  },
  Instit: {
    subject: "Projets et transformation — {{company_name}}",
    body: `Bonjour {{contact_name}},

Je prends contact avec vous concernant les enjeux stratégiques et institutionnels de {{company_name}}.

Seiki conseille les organisations institutionnelles dans leurs projets de transformation et de modernisation.

Je serais ravi d'échanger avec vous lors d'un bref rendez-vous.

Bien cordialement,
Jaafar EL ALAMY`,
  },
};

export const ManualSendPanel: React.FC<ManualSendPanelProps> = ({ showToast }) => {
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

  const handleTemplateChange = (selectedSegment: string) => {
    setTemplateId(selectedSegment);
    if (!selectedSegment) return;
    
    const segmentKey = selectedSegment as 'Media' | 'Retail' | 'Instit';
    const found = templates.find((t) => t.segment === segmentKey && t.step === 'initial');
    
    if (found) {
      const rendered = templatesService.renderTemplate(found, PLACEHOLDER_LEAD);
      setSubject(rendered.subject);
      setBody(rendered.body);
    } else if (DEFAULT_TEMPLATES[segmentKey]) {
      const fallback = DEFAULT_TEMPLATES[segmentKey];
      const rendered = templatesService.renderTemplate(fallback, PLACEHOLDER_LEAD);
      setSubject(rendered.subject);
      setBody(rendered.body);
    }
  };

  const handleSend = async () => {
    if (!toEmail || !subject || !body) {
      showToast('Adresse, sujet et corps sont requis', 'error');
      return;
    }
    setSending(true);
    try {
      const result = await emailsService.sendTestEmail(toEmail, subject, body);
      showToast(`Email envoyé avec succès à ${result.to}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi manuel', 'error');
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
          <Mail size={14} strokeWidth={2} className="text-[#D4C4A8]" />
          Envoyer un email manuel
        </span>
        {expanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
      </button>

      {expanded && (
        <div className="p-4 border-t border-line-strong bg-base space-y-3 font-ui">
          <p className="text-[11px] text-ink-faint">
            Envoi direct via le compte Gmail connecté — hors file d'approbation automatique.
          </p>

          <Field label="Adresse destinataire">
            <input
              type="email"
              className={inputClass}
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="destinataire@exemple.com"
            />
          </Field>

          <Field label="Template">
            <Select value={templateId} onValueChange={(val) => handleTemplateChange(val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— Choisir un template —" />
              </SelectTrigger>
              <SelectContent>
                {TEST_SEGMENTS.map((seg) => (
                  <SelectItem key={seg} value={seg}>
                    {seg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {sending ? 'Envoi en cours...' : "Envoyer l'email"}
          </AccentButton>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="ml-2">
            Fermer
          </Button>
        </div>
      )}
    </div>
  );
};
