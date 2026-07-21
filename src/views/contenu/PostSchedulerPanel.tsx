import React from 'react';
import { Image as ImageIcon, Loader2, RotateCcw, X, Calendar, Clock } from 'lucide-react';
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
          className="p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4 shadow-lg"
          style={{ background: 'var(--bg-panel)' }}
        >
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
            <Calendar size={15} className="text-[var(--gold)]" />
            <h3 className="text-xs font-semibold tracking-[0.25em] uppercase text-[var(--text-primary)]">
              Planifier la publication
            </h3>
          </div>

          <div className="flex gap-4 flex-wrap items-end pt-1">
            <div>
              <label
                className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Compte cible
              </label>
              <select
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="rounded-xl py-2.5 px-3 text-xs bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] cursor-pointer transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
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
              <label
                className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-xl p-2.5 text-xs bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] transition-all"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>

            <div>
              <label
                className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Heure
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="rounded-xl p-2.5 text-xs bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] transition-all"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>

            <div>
              <label
                className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5 flex items-center gap-1"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <ImageIcon size={13} className="text-[#c8b89a]" /> Image (optionnel)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="text-xs text-[var(--text-secondary)] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-black/40 file:text-[var(--text-primary)] hover:file:bg-black/60 cursor-pointer"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>

            <Button
              onClick={onSchedule}
              disabled={scheduling}
              className="bg-[var(--gold)] text-black font-semibold text-xs tracking-wider uppercase hover:bg-[var(--gold)]/90 transition-all px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-md"
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
        className="p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4 shadow-lg"
        style={{ background: 'var(--bg-panel)' }}
      >
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
          <Clock size={15} className="text-[var(--gold)]" />
          <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-[var(--text-primary)]">
            Posts programmés en file d'attente
          </h2>
        </div>

        {queue.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] py-4 text-center" style={{ fontFamily: 'var(--font-body)' }}>
            Aucun post programmé en attente.
          </p>
        )}
        {queue.map((p) => (
          <div
            key={p.id}
            className="p-3.5 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-black/40 hover:border-[#c8b89a]/30 transition-all"
          >
            <div className="min-w-0">
              <div
                className="text-sm font-medium text-[var(--text-primary)] truncate"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {p.hook}
              </div>
              <div
                className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-2 flex-wrap"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span className="text-[#c8b89a] font-medium">{accountLabel(p.target_account_id)}</span>
                <span>•</span>
                <span>{new Date(p.scheduled_at).toLocaleString('fr-FR')}</span>
                <span>•</span>
                <span
                  className={
                    p.status === 'failed'
                      ? 'text-rose-400 font-semibold px-2 py-0.5 rounded-md bg-rose-400/10'
                      : p.status === 'posted'
                      ? 'text-emerald-400 font-semibold px-2 py-0.5 rounded-md bg-emerald-400/10'
                      : 'text-[var(--gold)] font-medium px-2 py-0.5 rounded-md bg-[var(--gold)]/10'
                  }
                >
                  {p.status === 'scheduled' ? 'Programmé' : p.status === 'posted' ? 'Publié' : 'Échec'}
                </span>
                {p.status === 'failed' && p.error_message && ` — ${p.error_message}`}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {p.status === 'failed' && (
                <button
                  onClick={() => onRetry(p.id)}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-black/30 hover:border-[#c8b89a]/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                >
                  <RotateCcw size={13} className="text-[#c8b89a]" /> Relancer
                </button>
              )}
              {p.status === 'scheduled' && (
                <button
                  onClick={() => onCancel(p.id)}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:text-rose-300 hover:border-rose-500/40 transition-all cursor-pointer"
                >
                  <X size={13} /> Annuler
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

