import React, { useState, useMemo } from 'react';
import { Copy, Check, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { Field, inputClass } from './ui/Field';
import { Badge } from './ui/Badge';
import type { BadgeTone } from './ui/Badge';

interface EmailGeneratorProps {
  /** Pre-fill from form context */
  contactName?: string;
  website?: string;
  /** Called when user picks an email to use */
  onSelectEmail?: (email: string) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeName(raw: string): { first: string; last: string } {
  const parts = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents (combining diacritical marks left by NFD)
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .trim()
    .split(/\s+/);

  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts[parts.length - 1] };
}

function extractDomain(raw: string): string {
  return raw
    .replace(/https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .trim()
    .toLowerCase();
}

interface EmailPattern {
  id: string;
  label: string;
  build: (f: string, l: string, d: string) => string;
  /** Rough industry hit-rate — for confidence badge */
  confidence: 'high' | 'medium' | 'low';
}

const PATTERNS: EmailPattern[] = [
  { id: 'f.last',   label: 'prénom.nom@',        build: (f, l, d) => `${f}.${l}@${d}`,  confidence: 'high'   },
  { id: 'first',    label: 'prénom@',             build: (f, _, d) => `${f}@${d}`,        confidence: 'high'   },
  { id: 'flast',    label: 'prénomnom@',          build: (f, l, d) => `${f}${l}@${d}`,   confidence: 'medium' },
  { id: 'f_last',   label: 'prénom_nom@',         build: (f, l, d) => `${f}_${l}@${d}`,  confidence: 'medium' },
  { id: 'fi.last',  label: 'initiale.nom@',       build: (f, l, d) => `${f[0]}.${l}@${d}`, confidence: 'high' },
  { id: 'filast',   label: 'initialeNom@',        build: (f, l, d) => `${f[0]}${l}@${d}`, confidence: 'medium' },
  { id: 'last.fi',  label: 'nom.initiale@',       build: (f, l, d) => `${l}.${f[0]}@${d}`, confidence: 'low'  },
  { id: 'last',     label: 'nom@',                build: (_, l, d) => `${l}@${d}`,        confidence: 'low'   },
  { id: 'last.f',   label: 'nom.prénom@',         build: (f, l, d) => `${l}.${f}@${d}`,  confidence: 'low'   },
  { id: 'fi_last',  label: 'initiale_nom@',       build: (f, l, d) => `${f[0]}_${l}@${d}`, confidence: 'low' },
  { id: 'contact',  label: 'contact@',            build: (_, __, d) => `contact@${d}`,    confidence: 'low'   },
  { id: 'info',     label: 'info@',               build: (_, __, d) => `info@${d}`,       confidence: 'low'   },
];

const CONFIDENCE_TONE: Record<EmailPattern['confidence'], { label: string; tone: BadgeTone }> = {
  high:   { label: 'Haute',   tone: 'success' },
  medium: { label: 'Moyenne', tone: 'warning' },
  low:    { label: 'Faible',  tone: 'neutral' },
};

// ── component ─────────────────────────────────────────────────────────────────

export const EmailGenerator: React.FC<EmailGeneratorProps> = ({
  contactName = '',
  website = '',
  onSelectEmail,
}) => {
  const [inputName, setInputName] = useState(contactName);
  const [inputDomain, setInputDomain] = useState(extractDomain(website));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Sync props when parent form changes
  React.useEffect(() => { setInputName(contactName); }, [contactName]);
  React.useEffect(() => { setInputDomain(extractDomain(website)); }, [website]);

  const { first, last } = useMemo(() => normalizeName(inputName), [inputName]);
  const domain = useMemo(() => extractDomain(inputDomain), [inputDomain]);

  const ready = first.length > 0 && last.length > 0 && domain.includes('.');

  const emails = useMemo<Array<{ pattern: EmailPattern; email: string }>>(() => {
    if (!ready) return [];
    return PATTERNS
      .filter(p => {
        // skip generic patterns when we have a real person name
        if (first && last && ['contact', 'info'].includes(p.id)) return showAll;
        return true;
      })
      .map(p => ({ pattern: p, email: p.build(first, last, domain) }));
  }, [first, last, domain, ready, showAll]);

  const copy = (id: string, email: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const highConfidence = emails.filter(e => e.pattern.confidence === 'high');
  const rest = emails.filter(e => e.pattern.confidence !== 'high');

  return (
    <div className="mt-4 rounded-surface border border-line bg-elevated p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <Mail size={14} className="text-amber" />
        <span>Générateur d'emails</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Nom complet">
          <input
            type="text"
            placeholder="ex : Marie Évrard"
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Domaine">
          <input
            type="text"
            placeholder="ex : lvmh.fr"
            value={inputDomain}
            onChange={e => setInputDomain(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {!ready && (
        <div className="text-xs italic text-ink-faint">
          {!first || !last
            ? 'Entrez un prénom ET un nom pour générer les variantes.'
            : 'Entrez un domaine valide (ex : entreprise.com).'}
        </div>
      )}

      {ready && (
        <div className="flex flex-col gap-1.5">
          {highConfidence.map(({ pattern, email }) => (
            <EmailRow
              key={pattern.id}
              email={email}
              pattern={pattern}
              copiedId={copiedId}
              onCopy={copy}
              onSelect={onSelectEmail}
            />
          ))}

          {rest.length > 0 && (
            <>
              <button
                className="flex items-center gap-1 py-1 text-xs text-ink-soft transition-colors hover:text-ink cursor-pointer"
                onClick={() => setShowAll(v => !v)}
              >
                {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAll ? 'Masquer' : `${rest.length} variantes supplémentaires`}
              </button>

              {showAll && rest.map(({ pattern, email }) => (
                <EmailRow
                  key={pattern.id}
                  email={email}
                  pattern={pattern}
                  copiedId={copiedId}
                  onCopy={copy}
                  onSelect={onSelectEmail}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── sub-row ───────────────────────────────────────────────────────────────────

interface EmailRowProps {
  email: string;
  pattern: EmailPattern;
  copiedId: string | null;
  onCopy: (id: string, email: string) => void;
  onSelect?: (email: string) => void;
}

const EmailRow: React.FC<EmailRowProps> = ({ email, pattern, copiedId, onCopy, onSelect }) => {
  const cfg = CONFIDENCE_TONE[pattern.confidence];
  const isCopied = copiedId === pattern.id;

  return (
    <div className="flex items-center gap-2.5 rounded-control border border-line bg-surface px-3 py-2 text-xs">
      <Badge tone={cfg.tone} className="flex-shrink-0">{cfg.label}</Badge>
      <span className="w-24 flex-shrink-0 text-ink-faint">{pattern.label}</span>
      <span className="flex-1 truncate font-medium text-ink">{email}</span>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {onSelect && (
          <button
            className="rounded-control px-2 py-1 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-hover hover:text-ink cursor-pointer"
            onClick={() => onSelect(email)}
            title="Utiliser cet email"
          >
            Utiliser
          </button>
        )}
        <button
          className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-hover hover:text-ink cursor-pointer"
          onClick={() => onCopy(pattern.id, email)}
          title="Copier"
        >
          {isCopied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
};

export default EmailGenerator;
