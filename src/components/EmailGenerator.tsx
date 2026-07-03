import React, { useState, useMemo } from 'react';
import { Copy, Check, Mail, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

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
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
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

const CONFIDENCE_CONFIG = {
  high:   { label: 'Haute',   color: 'var(--green)',      bg: 'rgba(74,222,128,0.1)' },
  medium: { label: 'Moyenne', color: 'var(--gold)',       bg: 'rgba(245,183,49,0.1)' },
  low:    { label: 'Faible',  color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
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
    <div className="email-gen-panel">
      <div className="email-gen-header">
        <Mail size={14} style={{ color: 'var(--purple)' }} />
        <span>Générateur d'emails</span>
      </div>

      {/* Inputs */}
      <div className="email-gen-inputs">
        <div className="email-gen-field">
          <label>Nom complet</label>
          <input
            type="text"
            placeholder="ex : Marie Évrard"
            value={inputName}
            onChange={e => setInputName(e.target.value)}
          />
        </div>
        <div className="email-gen-field">
          <label>Domaine</label>
          <input
            type="text"
            placeholder="ex : lvmh.fr"
            value={inputDomain}
            onChange={e => setInputDomain(e.target.value)}
          />
        </div>
      </div>

      {/* Not ready hint */}
      {!ready && (
        <div className="email-gen-hint">
          {!first || !last
            ? 'Entrez un prénom ET un nom pour générer les variantes.'
            : 'Entrez un domaine valide (ex : entreprise.com).'}
        </div>
      )}

      {/* Results */}
      {ready && (
        <div className="email-gen-results">
          {/* High confidence first */}
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

          {/* Toggle rest */}
          {rest.length > 0 && (
            <>
              <button
                className="email-gen-toggle"
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
  const cfg = CONFIDENCE_CONFIG[pattern.confidence];
  const isCopied = copiedId === pattern.id;

  return (
    <div className="email-gen-row">
      <span
        className="email-gen-badge"
        style={{ color: cfg.color, background: cfg.bg }}
      >
        {cfg.label}
      </span>
      <span className="email-gen-label">{pattern.label}</span>
      <span className="email-gen-value">{email}</span>
      <div className="email-gen-actions">
        {onSelect && (
          <button
            className="email-gen-btn use"
            onClick={() => onSelect(email)}
            title="Utiliser cet email"
          >
            Utiliser
          </button>
        )}
        <button
          className="email-gen-btn copy"
          onClick={() => onCopy(pattern.id, email)}
          title="Copier"
        >
          {isCopied ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
};

export default EmailGenerator;
