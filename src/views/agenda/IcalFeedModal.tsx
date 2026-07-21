import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ICAL_FEED_URL } from '../../utils/icalHelpers';
import { useToast } from '../../context/ToastContext';

interface IcalFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IcalFeedModal: React.FC<IcalFeedModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(ICAL_FEED_URL);
      showToast('URL du flux iCal copiée !');
    } catch {
      showToast('Erreur de copie de l\'URL', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} header="Abonnement au flux iCal">
      <div className="p-6 space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Abonnez-vous à cet URL dans Google Calendar, Apple Calendar ou Outlook pour synchroniser automatiquement vos événements SEIKI CRM.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={ICAL_FEED_URL}
            className="flex-1 p-2 text-xs rounded-xl bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
          />
          <Button onClick={handleCopyUrl} className="bg-[var(--gold)] text-black font-semibold">
            Copier
          </Button>
        </div>
      </div>
    </Modal>
  );
};
