import React from 'react';
import { Mail, Eye, MessageSquare, Sparkles, Smile, Frown, Meh, ArrowUpRight, ArrowDownRight, ListOrdered } from 'lucide-react';
import type { EmailLog } from '../../services/prospectionService';
import { computeDelta, type DeltaResult } from '../../utils/dashboardCalculations';

export interface SequenceSummaryItem {
  id: string;
  name: string;
  [key: string]: any;
}

export interface DashboardOutreachTabProps {
  emailLogsA: EmailLog[];
  emailLogsB: EmailLog[];
  sequences?: SequenceSummaryItem[];
}

const DeltaBadge: React.FC<{ delta: DeltaResult; suffix?: string }> = ({ delta, suffix = '%' }) => {
  const isPositive = delta.percent > 0;
  const isNegative = delta.percent < 0;

  if (isPositive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-[#F59E0B] border border-amber-500/30">
        <ArrowUpRight className="w-3 h-3" />
        +{delta.percent}{suffix}
      </span>
    );
  }

  if (isNegative) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <ArrowDownRight className="w-3 h-3" />
        {delta.percent}{suffix}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#1e1e1e] text-ink-soft border border-line">
      0{suffix}
    </span>
  );
};

export const DashboardOutreachTab: React.FC<DashboardOutreachTabProps> = ({
  emailLogsA,
  emailLogsB,
  sequences = [],
}) => {
  // 1. Email Performance KPIs
  const isSent = (e: EmailLog) => e.status === 'sent' || !!e.sent_at || e.direction === 'outbound';
  const isOpened = (e: EmailLog) => !!e.opened_at || e.status === 'opened';
  const isReplied = (e: EmailLog) => !!e.replied_at || e.status === 'replied';

  const sentA = emailLogsA.filter(isSent).length || emailLogsA.length;
  const sentB = emailLogsB.filter(isSent).length || emailLogsB.length;
  const sentDelta = computeDelta(sentA, sentB);

  const openedA = emailLogsA.filter(isOpened).length;
  const openedB = emailLogsB.filter(isOpened).length;
  const openRateA = sentA > 0 ? Math.round((openedA / sentA) * 100) : 0;
  const openRateB = sentB > 0 ? Math.round((openedB / sentB) * 100) : 0;
  const openRateDelta = computeDelta(openRateA, openRateB);

  const repliedA = emailLogsA.filter(isReplied).length;
  const repliedB = emailLogsB.filter(isReplied).length;
  const replyRateA = sentA > 0 ? Math.round((repliedA / sentA) * 100) : 0;
  const replyRateB = sentB > 0 ? Math.round((repliedB / sentB) * 100) : 0;
  const replyRateDelta = computeDelta(replyRateA, replyRateB);

  // 2. Sentiment Analysis Breakdown
  const repliedLogsA = emailLogsA.filter(isReplied);
  const totalReplies = repliedLogsA.length || 1;

  const posCount = repliedLogsA.filter(
    (e) => e.reply_sentiment === 'positive' || (e.reply_sentiment_reason && e.reply_sentiment_reason.toLowerCase().includes('positif'))
  ).length;

  const negCount = repliedLogsA.filter(
    (e) => e.reply_sentiment === 'negative' || (e.reply_sentiment_reason && e.reply_sentiment_reason.toLowerCase().includes('négatif'))
  ).length;

  const neuCount = Math.max(0, totalReplies - posCount - negCount);

  const posPercent = Math.round((posCount / totalReplies) * 100);
  const negPercent = Math.round((negCount / totalReplies) * 100);
  const neuPercent = Math.round((neuCount / totalReplies) * 100);

  // 3. Sequence Performance Summary Table
  // If sequence objects are provided, calculate stats per sequence ID/Name; otherwise fallback to subject/log grouping
  const sequenceStats = React.useMemo(() => {
    if (sequences.length > 0) {
      return sequences.map((seq) => {
        const seqLogs = emailLogsA.filter((l) => (l as any).sequence_id === seq.id);
        const sSent = seqLogs.filter(isSent).length || seqLogs.length;
        const sReplied = seqLogs.filter(isReplied).length;
        const sReplyRate = sSent > 0 ? Math.round((sReplied / sSent) * 100) : 0;
        return {
          id: seq.id,
          name: seq.name,
          sent: sSent,
          replied: sReplied,
          replyRate: sReplyRate,
        };
      });
    }

    // Fallback: group by subject line or default sequences
    const subjectMap: Record<string, { sent: number; replied: number }> = {};
    emailLogsA.forEach((l) => {
      const name = l.subject || 'Séquence Standard';
      if (!subjectMap[name]) subjectMap[name] = { sent: 0, replied: 0 };
      if (isSent(l)) subjectMap[name].sent += 1;
      if (isReplied(l)) subjectMap[name].replied += 1;
    });

    return Object.entries(subjectMap).map(([name, data], idx) => ({
      id: `seq-${idx}`,
      name,
      sent: data.sent,
      replied: data.replied,
      replyRate: data.sent > 0 ? Math.round((data.replied / data.sent) * 100) : 0,
    }));
  }, [sequences, emailLogsA]);

  return (
    <div className="space-y-6">
      {/* Top Cards: Total Sent, Open Rate, Reply Rate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Sent */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Mail className="w-4 h-4 text-[#D4C4A8]" />
              <span>Emails Envoyés</span>
            </div>
            <DeltaBadge delta={sentDelta} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {sentA} <span className="text-sm font-normal text-ink-soft">emails</span>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              Volume total d'envois outbound traités sur la période.
            </p>
          </div>
        </div>

        {/* Card 2: Open Rate */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Eye className="w-4 h-4 text-[#F59E0B]" />
              <span>Taux d'Ouverture</span>
            </div>
            <DeltaBadge delta={openRateDelta} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {openRateA}% <span className="text-sm font-normal text-ink-soft">({openedA} ouverts)</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-[#1e1e1e] h-2 rounded-full overflow-hidden border border-line/40 mt-2">
              <div
                className="bg-gradient-to-r from-[#D4C4A8] to-[#F59E0B] h-full rounded-full transition-all duration-500"
                style={{ width: `${openRateA}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Reply Rate */}
        <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Taux de Réponse</span>
            </div>
            <DeltaBadge delta={replyRateDelta} />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#f2ede4] tracking-tight">
              {replyRateA}% <span className="text-sm font-normal text-ink-soft">({repliedA} réponses)</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-[#1e1e1e] h-2 rounded-full overflow-hidden border border-line/40 mt-2">
              <div
                className="bg-gradient-to-r from-emerald-500 to-[#F59E0B] h-full rounded-full transition-all duration-500"
                style={{ width: `${replyRateA}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sentiment Analysis Breakdown Card */}
      <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#F59E0B]/10 text-[#F59E0B] rounded-xl border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f2ede4]">Analyse de Sentiment IA (Gemini / Claude)</h3>
              <p className="text-[11px] text-ink-soft">Répartition de la tonalité des réponses obtenues</p>
            </div>
          </div>
          <span className="text-xs font-mono text-ink-soft">
            {repliedLogsA.length} réponses analysées
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Positive Sentiment */}
          <div className="bg-[#1e1e1e] border border-emerald-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-emerald-400">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Smile className="w-4 h-4" />
                <span>Positif (Intérêt)</span>
              </div>
              <span className="text-xs font-mono font-extrabold">{posPercent}%</span>
            </div>
            <div className="text-xl font-extrabold text-[#f2ede4]">{posCount}</div>
            <div className="w-full bg-[#141414] h-2 rounded-full overflow-hidden border border-line/40">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${posPercent}%` }}
              />
            </div>
          </div>

          {/* Neutral Sentiment */}
          <div className="bg-[#1e1e1e] border border-amber-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-[#F59E0B]">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Meh className="w-4 h-4" />
                <span>Neutre / Question</span>
              </div>
              <span className="text-xs font-mono font-extrabold">{neuPercent}%</span>
            </div>
            <div className="text-xl font-extrabold text-[#f2ede4]">{neuCount}</div>
            <div className="w-full bg-[#141414] h-2 rounded-full overflow-hidden border border-line/40">
              <div
                className="bg-[#F59E0B] h-full rounded-full transition-all duration-500"
                style={{ width: `${neuPercent}%` }}
              />
            </div>
          </div>

          {/* Negative Sentiment */}
          <div className="bg-[#1e1e1e] border border-rose-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-rose-400">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Frown className="w-4 h-4" />
                <span>Négatif / Refus</span>
              </div>
              <span className="text-xs font-mono font-extrabold">{negPercent}%</span>
            </div>
            <div className="text-xl font-extrabold text-[#f2ede4]">{negCount}</div>
            <div className="w-full bg-[#141414] h-2 rounded-full overflow-hidden border border-line/40">
              <div
                className="bg-rose-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${negPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sequence Performance Summary Table */}
      <div className="bg-[#141414] border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#D4C4A8]/10 text-[#D4C4A8] rounded-xl border border-[#D4C4A8]/20">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f2ede4]">Performance des Séquences de Prospection</h3>
              <p className="text-[11px] text-ink-soft">Volume d'envois et taux de réponse par séquence</p>
            </div>
          </div>
          <span className="text-xs font-mono text-ink-soft">
            {sequenceStats.length} séquences actives
          </span>
        </div>

        {sequenceStats.length === 0 ? (
          <div className="text-center py-6 text-xs text-ink-faint italic">Aucune donnée de séquence disponible.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#f2ede4]">
              <thead>
                <tr className="border-b border-line/80 text-ink-soft font-semibold text-[11px] uppercase tracking-wider">
                  <th className="pb-3 pl-2">Nom de la Séquence</th>
                  <th className="pb-3 text-right">Emails Envoyés</th>
                  <th className="pb-3 text-right">Réponses Obtenues</th>
                  <th className="pb-3 text-right pr-2">Taux de Réponse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {sequenceStats.map((seq) => (
                  <tr key={seq.id} className="hover:bg-[#1e1e1e]/60 transition-colors">
                    <td className="py-3 pl-2 font-bold text-[#f2ede4]">{seq.name}</td>
                    <td className="py-3 text-right font-mono">{seq.sent}</td>
                    <td className="py-3 text-right font-mono text-emerald-400">{seq.replied}</td>
                    <td className="py-3 text-right pr-2 font-mono font-bold text-[#F59E0B]">
                      {seq.replyRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
