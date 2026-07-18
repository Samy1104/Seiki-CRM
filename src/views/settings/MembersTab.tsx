import React from 'react';
import type { TeamMember } from '../../services/settingsService';
import { Trash2, Edit2 } from 'lucide-react';

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
  <div className="two-col" style={{ gap: '20px' }}>
    {/* Member List */}
    <div className="card" style={{ padding: '20px', flex: '1.5' }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
        Membres actifs
      </div>

      <div className="leads-table-container">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Avatar</th>
              <th>Nom</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td style={{ width: '50px' }}>
                  <div
                    className="member-avatar"
                    style={{
                      background: m.color,
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '12px'
                    }}
                  >
                    {m.initials}
                  </div>
                </td>
                <td style={{ fontWeight: '500' }}>{m.full_name}</td>
                <td>{m.email || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn-icon-del"
                      onClick={() => onStartEdit(m)}
                      title="Modifier le membre"
                      style={{ padding: '6px', color: 'var(--text-secondary)' }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn-icon-del"
                      onClick={() => onDelete(m.id)}
                      title="Retirer le membre"
                      style={{ padding: '6px' }}
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

    {/* Add / Edit Member Form */}
    <div className="card" style={{ padding: '20px', flex: '1' }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
        {editingMemberId ? 'Modifier le membre' : 'Ajouter un membre'}
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-field" style={{ marginBottom: '12px' }}>
          <div className="field-label">Prénom *</div>
          <input
            type="text"
            placeholder="ex : Marie"
            value={firstName}
            onChange={e => onFirstNameChange(e.target.value)}
            required
          />
        </div>

        <div className="form-field" style={{ marginBottom: '12px' }}>
          <div className="field-label">NOM *</div>
          <input
            type="text"
            placeholder="ex : DURAND"
            value={lastName}
            onChange={e => onLastNameChange(e.target.value)}
            required
          />
        </div>

        <div className="form-field" style={{ marginBottom: '16px' }}>
          <div className="field-label">Email</div>
          <input
            type="email"
            placeholder="marie@entreprise.com"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" className="btn btn-grad" style={{ flex: '1' }}>
            {editingMemberId ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editingMemberId && (
            <button type="button" className="btn" onClick={onCancelEdit}>
              Annuler
            </button>
          )}
        </div>
      </form>
    </div>
  </div>
);
