import React from 'react';
import { Image as ImageIcon, Loader2, RotateCcw, X, Calendar, Clock } from 'lucide-react';
import type { LinkedinAccount, ScheduledPost } from '../../services/linkedinService';
import type { LinkedInPost } from '../../services/contentService';
import { Button } from '../../components/ui/Button';
import { AccentButton } from '../../components/ui/AccentButton';
import { Badge } from '../../components/ui/Badge';
import { Field, inputClass } from '../../components/ui/Field';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';

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
      {/* Schedule Form */}
      {post && (
        <div className="p-6 rounded-surface border border-line-strong bg-surface space-y-4 shadow-hover">
          <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
            <Calendar size={15} strokeWidth={2} className="text-amber" />
            <h3 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
              Planifier la publication
            </h3>
          </div>

          <div className="flex gap-4 flex-wrap items-end pt-1">
            <Field label="Compte cible">
              <Select value={targetAccountId} onValueChange={(val) => setTargetAccountId(val)}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="— Choisir un compte —" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Date">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={`${inputClass} py-2 px-3 text-xs w-auto`}
              />
            </Field>

            <Field label="Heure">
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={`${inputClass} py-2 px-3 text-xs w-auto`}
              />
            </Field>

            <Field label="Image (optionnel)">
              <div className="flex items-center gap-1.5">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-ink-soft file:mr-2 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:text-xs file:bg-base file:text-ink hover:file:bg-hover cursor-pointer"
                />
              </div>
            </Field>

            <AccentButton
              variant="primary"
              onClick={onSchedule}
              disabled={scheduling}
              icon={
                scheduling ? (
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                ) : (
                  <Clock size={14} strokeWidth={2} />
                )
              }
            >
              {scheduling ? 'Programmation...' : 'Programmer'}
            </AccentButton>
          </div>
        </div>
      )}

      {/* Queue Listing */}
      <div className="p-6 rounded-surface border border-line-strong bg-surface space-y-4 shadow-hover">
        <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
          <Clock size={15} strokeWidth={2} className="text-amber" />
          <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
            Posts programmés en file d'attente
          </h2>
        </div>

        {queue.length === 0 && (
          <p className="text-xs font-ui text-ink-faint py-4 text-center">
            Aucun post programmé en attente.
          </p>
        )}
        {queue.map((p) => (
          <div
            key={p.id}
            className="p-3.5 rounded-control border border-line-strong flex items-center justify-between gap-3 bg-base hover:border-line-focus transition-all"
          >
            <div className="min-w-0">
              <div className="text-sm font-ui font-medium text-ink truncate">
                {p.hook}
              </div>
              <div className="text-xs font-ui text-ink-soft mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-amber font-medium">{accountLabel(p.target_account_id)}</span>
                <span>•</span>
                <span>{new Date(p.scheduled_at).toLocaleString('fr-FR')}</span>
                <span>•</span>
                <Badge
                  tone={
                    p.status === 'failed'
                      ? 'danger'
                      : p.status === 'posted'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {p.status === 'scheduled' ? 'Programmé' : p.status === 'posted' ? 'Publié' : 'Échec'}
                </Badge>
                {p.status === 'failed' && p.error_message && ` — ${p.error_message}`}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {p.status === 'failed' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onRetry(p.id)}
                >
                  <RotateCcw size={13} strokeWidth={2} className="text-amber" /> Relancer
                </Button>
              )}
              {p.status === 'scheduled' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onCancel(p.id)}
                >
                  <X size={13} strokeWidth={2} /> Annuler
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
