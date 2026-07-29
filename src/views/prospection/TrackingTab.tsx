import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, Loader2, RefreshCw, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp, Send, Eye, MessageSquare, Search, X } from 'lucide-react';
import { prospectionService, type EmailLog } from '../../services/prospectionService';
import { parseEmailBody } from '../../utils/emailParser';

type StatusFilter = 'all' | 'positive' | 'negative' | 'opened' | 'bounced';

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

const SENTIMENT_LABELS: Record<NonNullable<EmailLog['reply_sentiment']>, string> = {
  positive: 'Réponse positive (IA)',
  negative: 'Réponse négative (IA)',
  neutral: 'Réponse neutre (IA)',
};

const SENTIMENT_CLASSES: Record<NonNullable<EmailLog['reply_sentiment']>, string> = {
  positive: 'bg-success/10 text-success border-success/20',
  negative: 'bg-danger/10 text-danger border-danger/20',
  neutral: 'bg-surface text-ink-soft border-line-strong',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

interface DisplayEntry {
  log: EmailLog;
  replies: EmailLog[];
}

function groupByConversation(logs: EmailLog[]): DisplayEntry[] {
  const outbound = logs.filter((l) => l.direction === 'outbound');
  const outboundThreadIds = new Set(outbound.map((l) => l.gmail_thread_id).filter(Boolean));

  const repliesByThread = new Map<string, EmailLog[]>();
  const orphanInbound: EmailLog[] = [];
  for (const l of logs) {
    if (l.direction !== 'inbound') continue;
    if (l.gmail_thread_id && outboundThreadIds.has(l.gmail_thread_id)) {
      const arr = repliesByThread.get(l.gmail_thread_id) || [];
      arr.push(l);
      repliesByThread.set(l.gmail_thread_id, arr);
    } else {
      orphanInbound.push(l);
    }
  }

  const entries: DisplayEntry[] = [
    ...outbound.map((log) => ({ log, replies: log.gmail_thread_id ? repliesByThread.get(log.gmail_thread_id) || [] : [] })),
    ...orphanInbound.map((log) => ({ log, replies: [] })),
  ];

  entries.sort((a, b) => {
    const at = a.log.sent_at || a.log.received_at || a.log.created_at;
    const bt = b.log.sent_at || b.log.received_at || b.log.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  return entries;
}

interface EmailCardProps {
  avatarBadge: React.ReactNode;
  senderName: string;
  subHeader: string;
  timestamp: string | null;
  sentiment?: EmailLog['reply_sentiment'];
  body: string | null;
  isReply?: boolean;
}

const EmailCard: React.FC<EmailCardProps> = ({
  avatarBadge,
  senderName,
  subHeader,
  timestamp,
  sentiment,
  body,
  isReply = false,
}) => {
  const parsed = useMemo(() => parseEmailBody(body || ''), [body]);

  return (
    <div className={`space-y-2 ${isReply ? 'pl-3 border-l-2 border-success/40 mt-3' : ''}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          {avatarBadge}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-ink text-xs">{senderName}</span>
              {sentiment && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-control border ${SENTIMENT_CLASSES[sentiment]}`}>
                  {SENTIMENT_LABELS[sentiment]}
                </span>
              )}
            </div>
            <div className="text-[11px] text-ink-faint">{subHeader}</div>
          </div>
        </div>
        <span className="text-[11px] text-ink-faint whitespace-nowrap">{formatDate(timestamp)}</span>
      </div>

      <div className="bg-charcoal/30 border border-line-strong rounded-lg p-3 text-sm text-ink-soft">
        <div className="whitespace-pre-wrap leading-relaxed font-ui">
          {parsed.cleanBody || '(Aucun contenu)'}
        </div>
      </div>
    </div>
  );
};

export const TrackingTab: React.FC<TrackingTabProps> = ({ showToast }) => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await prospectionService.getRecentEmailLogs();
      setLogs(data);
    } catch {
      if (!silent) showToast('Erreur chargement du suivi', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(() => loadLogs(true), 30_000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  const entries = useMemo(() => groupByConversation(logs), [logs]);

  const counts = useMemo(() => {
    let positive = 0;
    let negative = 0;
    let opened = 0;
    let bounced = 0;

    for (const entry of entries) {
      const hasPos = entry.replies.some((r) => r.reply_sentiment === 'positive') || entry.log.reply_sentiment === 'positive';
      const hasNeg = entry.replies.some((r) => r.reply_sentiment === 'negative') || entry.log.reply_sentiment === 'negative';
      const isBounced = entry.log.status === 'bounced' || entry.log.status === 'failed' || entry.replies.some((r) => r.status === 'bounced' || r.status === 'failed');
      const isOpened = !!entry.log.opened_at && entry.replies.length === 0 && !hasPos && !hasNeg;

      if (hasPos) positive++;
      if (hasNeg) negative++;
      if (isBounced) bounced++;
      if (isOpened) opened++;
    }

    return {
      all: entries.length,
      positive,
      negative,
      opened,
      bounced,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 1. Status/Sentiment filter
      if (statusFilter === 'positive') {
        const hasPos = entry.replies.some((r) => r.reply_sentiment === 'positive') || entry.log.reply_sentiment === 'positive';
        if (!hasPos) return false;
      } else if (statusFilter === 'negative') {
        const hasNeg = entry.replies.some((r) => r.reply_sentiment === 'negative') || entry.log.reply_sentiment === 'negative';
        if (!hasNeg) return false;
      } else if (statusFilter === 'opened') {
        const isOpened = !!entry.log.opened_at && entry.replies.length === 0;
        if (!isOpened) return false;
      } else if (statusFilter === 'bounced') {
        const isBounced = entry.log.status === 'bounced' || entry.log.status === 'failed' || entry.replies.some((r) => r.status === 'bounced' || r.status === 'failed');
        if (!isBounced) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const contact = (entry.log.lead?.contact_name || '').toLowerCase();
        const company = (entry.log.lead?.company_name || '').toLowerCase();
        const to = (entry.log.to_email || '').toLowerCase();
        const from = (entry.log.from_email || '').toLowerCase();
        const subject = (entry.log.subject || '').toLowerCase();
        const body = (entry.log.body_preview || '').toLowerCase();
        const repliesBody = entry.replies.map((r) => (r.body_preview || '').toLowerCase() + ' ' + (r.from_email || '').toLowerCase()).join(' ');

        const match =
          contact.includes(q) ||
          company.includes(q) ||
          to.includes(q) ||
          from.includes(q) ||
          subject.includes(q) ||
          body.includes(q) ||
          repliesBody.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [entries, statusFilter, searchQuery]);

  return (
    <div className="space-y-4 font-ui">
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-line-strong">
        <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
          Suivi des emails
        </h2>
        <button
          onClick={() => loadLogs()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink rounded-control border border-line-strong hover:border-line-focus transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <RefreshCw size={13} strokeWidth={2} />}
          Actualiser
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher nom, entreprise, email, sujet..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-surface border border-line-strong rounded-control text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-focus transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors cursor-pointer"
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-control font-medium border transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-surface text-ink border-line-focus shadow-sm' : 'bg-transparent text-ink-soft border-transparent hover:border-line-strong'}`}
          >
            Tous <span className="opacity-60 text-[10px] ml-1">({counts.all})</span>
          </button>
          <button
            onClick={() => setStatusFilter('positive')}
            className={`px-2.5 py-1 rounded-control font-medium border transition-all cursor-pointer ${statusFilter === 'positive' ? 'bg-success/15 text-success border-success/30' : 'bg-transparent text-ink-soft border-transparent hover:border-line-strong'}`}
          >
            Positif (IA) <span className="opacity-60 text-[10px] ml-1">({counts.positive})</span>
          </button>
          <button
            onClick={() => setStatusFilter('negative')}
            className={`px-2.5 py-1 rounded-control font-medium border transition-all cursor-pointer ${statusFilter === 'negative' ? 'bg-danger/15 text-danger border-danger/30' : 'bg-transparent text-ink-soft border-transparent hover:border-line-strong'}`}
          >
            Négatif (IA) <span className="opacity-60 text-[10px] ml-1">({counts.negative})</span>
          </button>
          <button
            onClick={() => setStatusFilter('opened')}
            className={`px-2.5 py-1 rounded-control font-medium border transition-all cursor-pointer ${statusFilter === 'opened' ? 'bg-[#D4C4A8]/20 text-[#D4C4A8] border-[#D4C4A8]/30' : 'bg-transparent text-ink-soft border-transparent hover:border-line-strong'}`}
          >
            Non répondus <span className="opacity-60 text-[10px] ml-1">({counts.opened})</span>
          </button>
          <button
            onClick={() => setStatusFilter('bounced')}
            className={`px-2.5 py-1 rounded-control font-medium border transition-all cursor-pointer ${statusFilter === 'bounced' ? 'bg-danger/15 text-danger border-danger/30' : 'bg-transparent text-ink-soft border-transparent hover:border-line-strong'}`}
          >
            Rebonds <span className="opacity-60 text-[10px] ml-1">({counts.bounced})</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm font-ui text-ink-soft flex items-center justify-center gap-2">
          <Loader2 size={18} strokeWidth={2} className="animate-spin text-[#D4C4A8]" /> Chargement...
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 rounded-surface border border-line-strong bg-surface text-center font-ui space-y-2">
          <Activity size={32} strokeWidth={1.5} className="mx-auto text-ink-faint opacity-50" />
          <p className="text-sm text-ink-soft max-w-md mx-auto">
            Aucun email envoyé ou reçu pour l'instant.
          </p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-8 rounded-surface border border-line-strong bg-surface text-center font-ui space-y-3">
          <Search size={28} strokeWidth={1.5} className="mx-auto text-ink-faint opacity-50" />
          <p className="text-sm text-ink-soft">
            Aucun email ne correspond à votre recherche.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
            className="px-3 py-1.5 text-xs font-semibold text-[#D4C4A8] border border-[#D4C4A8]/30 hover:bg-[#D4C4A8]/10 rounded-control transition-all cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="space-y-2 font-ui">
          {filteredEntries.map(({ log, replies }) => {
            const hasNegSentiment = replies.some((r) => r.reply_sentiment === 'negative') || log.reply_sentiment === 'negative';
            const isReplied = log.status === 'replied' || replies.length > 0;

            return (
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
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-control border whitespace-nowrap ${
                        isReplied && hasNegSentiment
                          ? 'bg-danger/10 text-danger border-danger/20'
                          : STATUS_CLASSES[log.status]
                      }`}
                    >
                      {STATUS_LABELS[log.status]}
                    </span>
                    <div className="text-ink-faint">
                      {expandedId === log.id ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                    </div>
                  </div>
                </div>

                {expandedId === log.id && (
                  <div className="p-3 border-t border-line-strong bg-base space-y-4 text-xs">
                    {/* Step Progress Timeline Bar */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border border-line-strong bg-surface/50 text-xs">
                      <div className={`flex items-center gap-2 p-2 rounded-control border ${log.sent_at || log.received_at ? 'border-line-focus bg-surface text-ink' : 'border-line-strong text-ink-faint opacity-60'}`}>
                        <div className={`p-1.5 rounded-full ${log.sent_at || log.received_at ? 'bg-[#D4C4A8]/20 text-[#D4C4A8]' : 'bg-base text-ink-faint'}`}>
                          <Send size={13} strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{log.direction === 'inbound' ? 'Reçu' : 'Envoyé'}</div>
                          <div className="text-[11px] text-ink-soft truncate">{formatDate(log.sent_at || log.received_at)}</div>
                        </div>
                      </div>

                      <div className={`flex items-center gap-2 p-2 rounded-control border ${log.opened_at ? 'border-success/30 bg-success/5 text-success' : 'border-line-strong text-ink-faint opacity-60'}`}>
                        <div className={`p-1.5 rounded-full ${log.opened_at ? 'bg-success/20 text-success' : 'bg-base text-ink-faint'}`}>
                          <Eye size={13} strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">Ouvert</div>
                          <div className="text-[11px] text-ink-soft truncate">{log.opened_at ? formatDate(log.opened_at) : 'Non ouvert'}</div>
                        </div>
                      </div>

                      <div className={`flex items-center gap-2 p-2 rounded-control border ${
                        isReplied
                          ? hasNegSentiment
                            ? 'border-danger/30 bg-danger/5 text-danger'
                            : 'border-success/30 bg-success/5 text-success'
                          : 'border-line-strong text-ink-faint opacity-60'
                      }`}>
                        <div className={`p-1.5 rounded-full ${
                          isReplied
                            ? hasNegSentiment
                              ? 'bg-danger/20 text-danger'
                              : 'bg-success/20 text-success'
                            : 'bg-base text-ink-faint'
                        }`}>
                          <MessageSquare size={13} strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">Répondu</div>
                          <div className="text-[11px] text-ink-soft truncate">
                            {log.replied_at || replies[0]?.received_at ? formatDate(log.replied_at || replies[0]?.received_at) : 'Pas de réponse'}
                          </div>
                        </div>
                      </div>
                    </div>

                  {log.error_message && (
                    <p className="text-danger p-2 rounded bg-danger/10 border border-danger/20">{log.error_message}</p>
                  )}

                  {/* Outbound/Primary Email Card */}
                  {log.body_preview && (
                    <EmailCard
                      avatarBadge={
                        log.direction === 'outbound' ? (
                          <div className="w-7 h-7 rounded-full bg-[#D4C4A8]/20 text-[#D4C4A8] border border-[#D4C4A8]/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            SK
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-success/20 text-success border border-success/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            {(log.lead?.contact_name || log.from_email || 'L').charAt(0).toUpperCase()}
                          </div>
                        )
                      }
                      senderName={log.direction === 'outbound' ? 'Seiki CRM' : (log.lead?.contact_name || log.from_email || 'Contact')}
                      subHeader={log.direction === 'outbound' ? `à ${log.to_email}` : `de ${log.from_email}`}
                      timestamp={log.sent_at || log.received_at || log.created_at}
                      body={log.body_preview}
                    />
                  )}

                  {/* Inbound Reply Cards */}
                  {replies.map((reply) => (
                    <EmailCard
                      key={reply.id}
                      isReply
                      avatarBadge={
                        <div className="w-7 h-7 rounded-full bg-success/20 text-success border border-success/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                          {(log.lead?.contact_name || reply.from_email || 'L').charAt(0).toUpperCase()}
                        </div>
                      }
                      senderName={log.lead?.contact_name || reply.from_email || 'Contact'}
                      subHeader={`de ${reply.from_email || 'inconnu'}`}
                      timestamp={reply.received_at}
                      sentiment={reply.reply_sentiment}
                      body={reply.body_preview}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

