import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Loader2, RefreshCw, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { prospectionService, type EmailLog } from '../../services/prospectionService';

interface TrackingTabProps {
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

const STATUS_LABELS: Record<EmailLog['status'], string> = {
  pending: 'En attente',
  sent: 'Envoyé',
  delivered: 'Délivré',
  opened: 'Ouvert',
  replied: 'Répondu',
  bounced: 'Rebond',
  failed: 'Échec',
};

const STATUS_CLASSES: Record<EmailLog['status'], string> = {
  pending: 'bg-surface text-ink-soft border-line-strong',
  sent: 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus',
  delivered: 'bg-[#D4C4A8]/15 text-[#D4C4A8] border-line-focus',
  opened: 'bg-success/10 text-success border-success/20',
  replied: 'bg-success/10 text-success border-success/20',
  bounced: 'bg-danger/10 text-danger border-danger/20',
  failed: 'bg-danger/10 text-danger border-danger/20',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export const TrackingTab: React.FC<TrackingTabProps> = ({ showToast }) => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await prospectionService.getRecentEmailLogs();
      setLogs(data);
    } catch {
      showToast('Erreur chargement du suivi', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-line-strong">
        <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
          Suivi des emails
        </h2>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink rounded-control border border-line-strong hover:border-line-focus transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <RefreshCw size={13} strokeWidth={2} />}
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm font-ui text-ink-soft flex items-center justify-center gap-2">
          <Loader2 size={18} strokeWidth={2} className="animate-spin text-[#D4C4A8]" /> Chargement...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 rounded-surface border border-line-strong bg-surface text-center font-ui space-y-2">
          <Activity size={32} strokeWidth={1.5} className="mx-auto text-ink-faint opacity-50" />
          <p className="text-sm text-ink-soft max-w-md mx-auto">
            Aucun email envoyé ou reçu pour l'instant.
          </p>
        </div>
      ) : (
        <div className="space-y-2 font-ui">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-surface border border-line-strong bg-surface overflow-hidden"
            >
              <div
                className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-hover transition-colors"
                onClick={() => setExpandedId((prev) => (prev === log.id ? null : log.id))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {log.direction === 'outbound' ? (
                    <ArrowUpRight size={15} strokeWidth={2} className="text-[#D4C4A8] shrink-0" />
                  ) : (
                    <ArrowDownLeft size={15} strokeWidth={2} className="text-success shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-ink font-semibold text-sm">
                        {log.lead?.contact_name || (log.lead_id ? '—' : 'Test (sans lead)')}
                      </strong>
                      {log.lead?.company_name && (
                        <span className="text-xs text-ink-soft bg-base px-2 py-0.5 rounded-control border border-line-strong">
                          {log.lead.company_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-soft truncate mt-0.5">
                      {log.subject || '(sans sujet)'} — {log.direction === 'outbound' ? `à ${log.to_email}` : `de ${log.from_email}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-ink-faint whitespace-nowrap">
                    {formatDate(log.sent_at || log.received_at || log.created_at)}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-control border whitespace-nowrap ${STATUS_CLASSES[log.status]}`}>
                    {STATUS_LABELS[log.status]}
                  </span>
                  <div className="text-ink-faint">
                    {expandedId === log.id ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                  </div>
                </div>
              </div>

              {expandedId === log.id && (
                <div className="p-3 border-t border-line-strong bg-base space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-ink-soft">
                    <span>Envoyé : {formatDate(log.sent_at)}</span>
                    <span>Ouvert : {formatDate(log.opened_at)}</span>
                    <span>Répondu : {formatDate(log.replied_at)}</span>
                    <span>Reçu : {formatDate(log.received_at)}</span>
                  </div>
                  {log.error_message && (
                    <p className="text-danger">{log.error_message}</p>
                  )}
                  {log.body_preview && (
                    <p className="text-ink-soft whitespace-pre-line bg-surface p-2 rounded-control border border-line-strong">
                      {log.body_preview}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
