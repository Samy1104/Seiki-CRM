import React from 'react';
import type { TeamMember } from '../../services/settingsService';
import { Trash2, Edit2, UserPlus, UserCheck, X } from 'lucide-react';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';

interface MembersTabProps {
  members: TeamMember[];
  editingMemberId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStartEdit: (member: TeamMember) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  members,
  editingMemberId,
  firstName,
  lastName,
  email,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onSubmit,
  onStartEdit,
  onCancelEdit,
  onDelete,
}) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
    {/* Active Members Card */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Membres de l'équipe</h2>
          <p className="text-[11px] text-ink-soft">Collaborateurs ayant accès au CRM</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D4C4A8]/15 text-[#D4C4A8] border border-line-focus">
          {members.length} membres
        </span>
      </div>

      <div className="overflow-hidden rounded-control border border-line bg-surface/50">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-surface text-[10.5px] font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-4 py-3">Membre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map(m => (
              <tr key={m.id} className="transition-colors hover:bg-hover/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                      style={{ background: m.color || '#6B5FE6' }}
                    >
                      {m.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{m.full_name}</div>
                      <div className="text-[11px] text-[#D4C4A8] font-medium">{m.role_label || 'Collaborateur'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{m.email || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-hover hover:text-ink cursor-pointer"
                      onClick={() => onStartEdit(m)}
                      title="Modifier le membre"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                      onClick={() => onDelete(m.id)}
                      title="Retirer le membre"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Form Card */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="mb-4 pb-3 border-b border-line">
          <h2 className="font-display text-base font-bold text-ink">
            {editingMemberId ? 'Modifier le membre' : 'Ajouter un membre'}
          </h2>
          <p className="text-[11px] text-ink-soft">
            {editingMemberId ? 'Mettre à jour les informations du collaborateur' : 'Inviter un nouveau membre sur la plateforme'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Prénom *">
            <input
              type="text"
              placeholder="ex : Marie"
              value={firstName}
              onChange={e => onFirstNameChange(e.target.value)}
              required
              className={inputClass}
            />
          </Field>

          <Field label="NOM *">
            <input
              type="text"
              placeholder="ex : DURAND"
              value={lastName}
              onChange={e => onLastNameChange(e.target.value)}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              placeholder="marie@entreprise.com"
              value={email}
              onChange={e => onEmailChange(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="mt-2 flex gap-2">
            <AccentButton type="submit" variant="primary" icon={editingMemberId ? <UserCheck size={14} /> : <UserPlus size={14} />} className="flex-1">
              {editingMemberId ? 'Enregistrer' : 'Ajouter le membre'}
            </AccentButton>
            {editingMemberId && (
              <AccentButton type="button" variant="secondary" icon={<X size={14} />} onClick={onCancelEdit}>
                Annuler
              </AccentButton>
            )}
          </div>
        </form>
      </div>
    </div>
  </div>
);
