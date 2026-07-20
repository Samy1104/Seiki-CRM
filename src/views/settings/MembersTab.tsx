import React from 'react';
import type { TeamMember } from '../../services/settingsService';
import { Trash2, Edit2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
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
  <div className="grid grid-cols-[1.5fr_1fr] gap-5">
    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-3.5 text-sm font-bold text-ink">Membres actifs</div>

      <div className="overflow-hidden rounded-control border border-line">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-surface text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5">Avatar</th>
              <th className="px-3 py-2.5">Nom</th>
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-line last:border-b-0">
                <td className="px-3 py-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: m.color }}
                  >
                    {m.initials}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-medium text-ink">{m.full_name}</td>
                <td className="px-3 py-2.5 text-ink-soft">{m.email || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button
                      className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-hover hover:text-ink cursor-pointer"
                      onClick={() => onStartEdit(m)}
                      title="Modifier le membre"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
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

    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-3.5 text-sm font-bold text-ink">
        {editingMemberId ? 'Modifier le membre' : 'Ajouter un membre'}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
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

        <div className="mt-1 flex gap-2">
          <Button type="submit" variant="primary" className="flex-1">
            {editingMemberId ? 'Enregistrer' : 'Ajouter'}
          </Button>
          {editingMemberId && (
            <Button type="button" variant="secondary" onClick={onCancelEdit}>Annuler</Button>
          )}
        </div>
      </form>
    </div>
  </div>
);
