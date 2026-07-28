import React from 'react';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface ProspectionSettingsTabProps {
  followup1Days: number;
  followup2Days: number;
  archiveAfter: number;
  gmailDailyCap: number | null;
  gmailWarmupStartDate: string | null;
  gmailWindowStart: string;
  gmailWindowEnd: string;
  gmailFromName: string;
  onFollowup1DaysChange: (v: number) => void;
  onFollowup2DaysChange: (v: number) => void;
  onArchiveAfterChange: (v: number) => void;
  onGmailDailyCapChange: (v: number | null) => void;
  onGmailWarmupStartDateChange: (v: string | null) => void;
  onGmailWindowStartChange: (v: string) => void;
  onGmailWindowEndChange: (v: string) => void;
  onGmailFromNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ProspectionSettingsTab: React.FC<ProspectionSettingsTabProps> = ({
  followup1Days,
  followup2Days,
  archiveAfter,
  gmailDailyCap,
  gmailWarmupStartDate,
  gmailWindowStart,
  gmailWindowEnd,
  gmailFromName,
  onFollowup1DaysChange,
  onFollowup2DaysChange,
  onArchiveAfterChange,
  onGmailDailyCapChange,
  onGmailWarmupStartDateChange,
  onGmailWindowStartChange,
  onGmailWindowEndChange,
  onGmailFromNameChange,
  onSubmit,
}) => (
  <div className="space-y-4">
    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-3.5 text-sm font-bold text-ink">Envoi Gmail — pacing anti-spam</div>
      <p className="text-[11px] text-ink-faint mb-4">
        Le volume envoyé chaque jour monte progressivement depuis la date de début de warm-up jusqu'au plafond cible ci-dessous,
        et reste confiné à la fenêtre horaire indiquée (jours ouvrés, heures de bureau) — protège le compte Gmail personnel
        contre les signalements spam en prospection à froid.
      </p>
      <form onSubmit={onSubmit}>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date de début du warm-up">
            <input
              type="date"
              value={gmailWarmupStartDate ?? ''}
              onChange={(e) => onGmailWarmupStartDateChange(e.target.value || null)}
              className={inputClass}
            />
          </Field>

          <Field label="Plafond quotidien cible">
            <input
              type="number"
              value={gmailDailyCap ?? ''}
              onChange={(e) => onGmailDailyCapChange(e.target.value ? parseInt(e.target.value) : null)}
              min={1}
              className={inputClass}
            />
            <span className="text-[10px] text-ink-faint">Volume max/jour une fois le warm-up terminé.</span>
          </Field>

          <Field label="Début de la fenêtre d'envoi">
            <input type="time" value={gmailWindowStart} onChange={(e) => onGmailWindowStartChange(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Fin de la fenêtre d'envoi">
            <input type="time" value={gmailWindowEnd} onChange={(e) => onGmailWindowEndChange(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Nom d'expéditeur affiché" className="sm:col-span-2">
            <input
              value={gmailFromName}
              onChange={(e) => onGmailFromNameChange(e.target.value)}
              className={inputClass}
              placeholder="Seiki CRM"
            />
            <span className="text-[10px] text-ink-faint">Nom affiché avant l'adresse dans le champ "De" (ex: "{gmailFromName || 'Seiki CRM'} &lt;{'{votre adresse}'}&gt;").</span>
          </Field>
        </div>
        <Button type="submit" variant="primary">Enregistrer les paramètres</Button>
      </form>
    </div>

    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-3.5 text-sm font-bold text-ink">Relances</div>
      <form onSubmit={onSubmit}>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Délai avant 1ère relance (jours)">
            <input type="number" value={followup1Days} onChange={(e) => onFollowup1DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>

          <Field label="Délai avant 2ème relance (jours)">
            <input type="number" value={followup2Days} onChange={(e) => onFollowup2DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>

          <Field label="Relances avant archivage">
            <input type="number" value={archiveAfter} onChange={(e) => onArchiveAfterChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>
        </div>
        <Button type="submit" variant="primary">Enregistrer les paramètres</Button>
      </form>
    </div>
  </div>
);
