import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import CalendarModal from '../../components/CalendarModal';
import type { EventItem } from '../../services/eventsService';

const segments = [
  'Tous les segments',
  'Général',
  'Média',
  'Investisseurs',
  'Partenaires',
];

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEvent: EventItem | null;
  onSubmit: (eventData: Omit<EventItem, 'id' | 'created_at' | 'updated_at' | 'ical_uid'>) => Promise<void>;
  formatDateFr: (d: string) => string;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  editingEvent,
  onSubmit,
  formatDateFr,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [segment, setSegment] = useState('Tous les segments');
  const [objective, setObjective] = useState('');

  const [openCal, setOpenCal] = useState<'startDate' | 'endDate' | null>(null);
  const startDateRef = useRef<HTMLButtonElement>(null);
  const endDateRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editingEvent) {
      setName(editingEvent.name);
      setLocation(editingEvent.location || '');
      setStartDate(editingEvent.event_date);
      setEndDate(editingEvent.end_date || '');
      setSegment(editingEvent.segment || 'Tous les segments');
      setObjective(editingEvent.objective || '');
    } else {
      setName('');
      setLocation('');
      setStartDate('');
      setEndDate('');
      setSegment('Tous les segments');
      setObjective('');
    }
  }, [editingEvent, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate) return;

    await onSubmit({
      name: name.trim(),
      event_date: startDate,
      end_date: endDate || null,
      location: location.trim() || null,
      segment: segment === 'Tous les segments' ? null : segment,
      objective: objective.trim() || null,
      created_by: null,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      header={editingEvent ? 'Modifier l\'événement' : 'Ajouter un événement'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        <Field label="Nom de l'événement *">
          <input
            type="text"
            placeholder="ex : MIPIM Cannes"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </Field>

        <Field label="Lieu">
          <input
            type="text"
            placeholder="ex : Cannes, France"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date de début *">
            <div className="relative">
              <button
                ref={startDateRef}
                type="button"
                onClick={() => setOpenCal(openCal === 'startDate' ? null : 'startDate')}
                className={`${inputClass} flex items-center justify-between w-full text-left cursor-pointer`}
              >
                <span>{startDate ? formatDateFr(startDate) : 'jj/mm/aaaa'}</span>
                <CalendarIcon size={14} className="text-[var(--text-muted)]" />
              </button>
              {openCal === 'startDate' && (
                <CalendarModal
                  value={startDate}
                  onChange={(v) => {
                    setStartDate(v);
                    setOpenCal(null);
                  }}
                  onClose={() => setOpenCal(null)}
                  anchorRef={startDateRef}
                />
              )}
            </div>
          </Field>

          <Field label="Date de fin">
            <div className="relative">
              <button
                ref={endDateRef}
                type="button"
                onClick={() => setOpenCal(openCal === 'endDate' ? null : 'endDate')}
                className={`${inputClass} flex items-center justify-between w-full text-left cursor-pointer`}
              >
                <span>{endDate ? formatDateFr(endDate) : 'jj/mm/aaaa'}</span>
                <CalendarIcon size={14} className="text-[var(--text-muted)]" />
              </button>
              {openCal === 'endDate' && (
                <CalendarModal
                  value={endDate}
                  onChange={(v) => {
                    setEndDate(v);
                    setOpenCal(null);
                  }}
                  onClose={() => setOpenCal(null)}
                  anchorRef={endDateRef}
                  minDate={startDate || undefined}
                />
              )}
            </div>
          </Field>
        </div>

        <Field label="Segment ciblé">
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            {segments.map((s) => (
              <option key={s} value={s} className="bg-[var(--color-surface)] text-[var(--text-primary)]">
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Objectif / Action clé">
          <input
            type="text"
            placeholder="ex : Rencontre 5 prospects et qualification"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" className="bg-[var(--gold)] text-black font-semibold">
            {editingEvent ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
