import React from 'react';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';
import { Save, ShieldCheck, MailCheck } from 'lucide-react';

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
  <div className="space-y-6 max-w-4xl">
    {/* Anti-spam Gmail Section */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#D4C4A8]" />
            Envoi Gmail & Warm-up Anti-Spam
          </h2>
          <p className="text-[11px] text-ink-soft mt-0.5">
            Pacing quotidien et plage horaire pour protéger la délivrabilité de votre compte.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            <span className="text-[10px] text-ink-soft mt-1 block">Volume max emails/jour.</span>
          </Field>

          <Field label="Fenêtre d'envoi (Début)">
            <input type="time" value={gmailWindowStart} onChange={(e) => onGmailWindowStartChange(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Fenêtre d'envoi (Fin)">
            <input type="time" value={gmailWindowEnd} onChange={(e) => onGmailWindowEndChange(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Nom d'expéditeur affiché" className="sm:col-span-2">
            <input
              value={gmailFromName}
              onChange={(e) => onGmailFromNameChange(e.target.value)}
              className={inputClass}
              placeholder="Seiki CRM"
            />
            <span className="text-[10px] text-ink-soft mt-1 block">Nom affiché avant l'adresse (ex: "{gmailFromName || 'Seiki CRM'}").</span>
          </Field>
        </div>
        <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
          Enregistrer la prospection
        </AccentButton>
      </form>
    </div>

    {/* Relances Section */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <MailCheck size={18} className="text-[#D4C4A8]" />
            Séquence de Relance Automatique
          </h2>
          <p className="text-[11px] text-ink-soft mt-0.5">Intervalle de jours entre relances et règles d'archivage.</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Délai 1ère relance (jours)">
            <input type="number" value={followup1Days} onChange={(e) => onFollowup1DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>

          <Field label="Délai 2ème relance (jours)">
            <input type="number" value={followup2Days} onChange={(e) => onFollowup2DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>

          <Field label="Relances avant archivage">
            <input type="number" value={archiveAfter} onChange={(e) => onArchiveAfterChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          </Field>
        </div>
        <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
          Enregistrer les relances
        </AccentButton>
      </form>
    </div>
  </div>
);

