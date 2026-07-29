import React from 'react';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';
import { Save, ShieldCheck, MailCheck, Sparkles } from 'lucide-react';
import type { PipelineStage } from '../../services/settingsService';

interface ProspectionSettingsTabProps {
  followup1Days: number;
  followup2Days: number;
  archiveAfter: number;
  gmailDailyCap: number | null;
  gmailWarmupStartDate: string | null;
  gmailWindowStart: string;
  gmailWindowEnd: string;
  gmailFromName: string;
  pipelineStages: PipelineStage[];
  replyAiClassificationEnabled: boolean;
  replyPositiveStageId: string | null;
  replyNegativeStageId: string | null;
  onFollowup1DaysChange: (v: number) => void;
  onFollowup2DaysChange: (v: number) => void;
  onArchiveAfterChange: (v: number) => void;
  onGmailDailyCapChange: (v: number | null) => void;
  onGmailWarmupStartDateChange: (v: string | null) => void;
  onGmailWindowStartChange: (v: string) => void;
  onGmailWindowEndChange: (v: string) => void;
  onGmailFromNameChange: (v: string) => void;
  onReplyAiClassificationEnabledChange: (v: boolean) => void;
  onReplyPositiveStageIdChange: (v: string | null) => void;
  onReplyNegativeStageIdChange: (v: string | null) => void;
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
  pipelineStages,
  replyAiClassificationEnabled,
  replyPositiveStageId,
  replyNegativeStageId,
  onFollowup1DaysChange,
  onFollowup2DaysChange,
  onArchiveAfterChange,
  onGmailDailyCapChange,
  onGmailWarmupStartDateChange,
  onGmailWindowStartChange,
  onGmailWindowEndChange,
  onGmailFromNameChange,
  onReplyAiClassificationEnabledChange,
  onReplyPositiveStageIdChange,
  onReplyNegativeStageIdChange,
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

    {/* Reply AI Classification Section */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <Sparkles size={18} className="text-[#D4C4A8]" />
            Analyse IA des réponses
          </h2>
          <p className="text-[11px] text-ink-soft mt-0.5">
            Classification automatique du ton des réponses reçues, et déplacement du lead dans le pipeline.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="mb-6 flex items-center justify-between border border-line rounded-control p-4 bg-surface/40">
          <div>
            <div className="text-[13px] font-semibold text-ink">Activer la classification automatique</div>
            <div className="mt-0.5 text-[11px] text-ink-soft max-w-xl">
              Chaque réponse reçue est analysée (positive / négative / neutre) dès sa détection.
            </div>
          </div>
          <label className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={replyAiClassificationEnabled}
              onChange={(e) => onReplyAiClassificationEnabledChange(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-hover transition-colors peer-checked:bg-[#D4C4A8]"></span>
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-[#0d0d0d] transition-transform peer-checked:translate-x-5"></span>
          </label>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Réponse positive →">
            <select
              value={replyPositiveStageId ?? ''}
              onChange={(e) => onReplyPositiveStageIdChange(e.target.value || null)}
              className={inputClass}
            >
              <option value="">— Ne pas déplacer —</option>
              {pipelineStages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Réponse négative →">
            <select
              value={replyNegativeStageId ?? ''}
              onChange={(e) => onReplyNegativeStageIdChange(e.target.value || null)}
              className={inputClass}
            >
              <option value="">— Ne pas déplacer —</option>
              {pipelineStages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
          Enregistrer l'analyse des réponses
        </AccentButton>
      </form>
    </div>
  </div>
);


