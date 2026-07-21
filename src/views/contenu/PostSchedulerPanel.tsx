import React from 'react';
import { Image as ImageIcon, Loader2, RotateCcw, X } from 'lucide-react';
import type { LinkedinAccount, ScheduledPost } from '../../services/linkedinService';
import type { LinkedInPost } from '../../services/contentService';
import { Button } from '../../components/ui/Button';

interface PostSchedulerPanelProps {
  post: LinkedInPost | null;
  accounts: LinkedinAccount[];
  queue: ScheduledPost[];
  targetAccountId: string;
  setTargetAccountId: (id: string) => void;
  scheduledDate: string;
  setScheduledDate: (d: string) => void;
  scheduledTime: string;
  setScheduledTime: (t: string) => void;
  setImageFile: (f: File | null) => void;
  scheduling: boolean;
  onSchedule: () => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export const PostSchedulerPanel: React.FC<PostSchedulerPanelProps> = ({
  post,
  accounts,
  queue,
  targetAccountId,
  setTargetAccountId,
  scheduledDate,
  setScheduledDate,
  scheduledTime,
  setScheduledTime,
  setImageFile,
  scheduling,
  onSchedule,
  onCancel,
  onRetry,
}) => {
  const accountLabel = (id: string) => accounts.find((a) => a.id === id)?.label ?? 'Compte inconnu';

  return (
    <div className="space-y-6">
      {/* Schedule Form (when a post is active) */}
      {post && (
        <div
          className="p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4"
          style={{ background: 'var(--bg-panel)' }}
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Planifier la publication</h3>

          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="block text-xs mb-1 text-[var(--text-secondary)]">Compte cible</label>
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="rounded-xl p-2.5 text-xs bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[var(--color-surface)]">— Choisir —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-[var(--color-surface)]">
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1 text-[var(--text-secondary)]">Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-xl p-2 text-xs bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-[var(--text-secondary)]">Heure</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="rounded-xl p-2 text-xs bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-[var(--text-secondary)] flex items-center gap-1">
                <ImageIcon size={14} /> Image (optionnel)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="text-xs text-[var(--text-secondary)]"
              />
            </div>

            <Button
              onClick={onSchedule}
              disabled={scheduling}
              className="bg-[var(--gold)] text-black font-semibold hover:bg-[var(--gold)]/90"
            >
              {scheduling ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Programmation...</span>
                </>
              ) : (
                <span>Programmer</span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Queue Listing */}
      <div
        className="p-6 rounded-2xl border border-[var(--border-subtle)] space-y-3"
        style={{ background: 'var(--bg-panel)' }}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Posts programmés</h2>
        {queue.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">Aucun post programmé.</p>
        )}
        {queue.map((p) => (
          <div
            key={p.id}
            className="p-3 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-black/20"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)] truncate">{p.hook}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {accountLabel(p.target_account_id)} · {new Date(p.scheduled_at).toLocaleString('fr-FR')} ·{' '}
                <span
                  className={
                    p.status === 'failed'
                      ? 'text-rose-400 font-semibold'
                      : p.status === 'posted'
                      ? 'text-emerald-400 font-semibold'
                      : 'text-[var(--text-secondary)]'
                  }
                >
                  {p.status}
                </span>
                {p.status === 'failed' && p.error_message && ` — ${p.error_message}`}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {p.status === 'failed' && (
                <button
                  onClick={() => onRetry(p.id)}
                  className="text-xs flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} /> Relancer
                </button>
              )}
              {p.status === 'scheduled' && (
                <button
                  onClick={() => onCancel(p.id)}
                  className="text-xs flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  <X size={14} /> Annuler
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
