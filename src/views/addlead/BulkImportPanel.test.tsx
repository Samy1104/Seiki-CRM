import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '../../context/ToastContext';

vi.mock('../../services/leadImportService', () => ({
  leadImportService: {
    parseFile: vi.fn(),
    fetchExistingLeadsByEmail: vi.fn(),
    getProspectStageId: vi.fn(),
    validateRows: vi.fn(),
    commitImport: vi.fn(),
  },
}));

import { leadImportService } from '../../services/leadImportService';
import { BulkImportPanel } from './BulkImportPanel';

function renderPanel() {
  return render(
    <ToastProvider>
      <BulkImportPanel setView={vi.fn()} />
    </ToastProvider>
  );
}

describe('BulkImportPanel', () => {
  beforeEach(() => {
    vi.mocked(leadImportService.parseFile).mockReset();
    vi.mocked(leadImportService.fetchExistingLeadsByEmail).mockReset();
    vi.mocked(leadImportService.getProspectStageId).mockReset();
    vi.mocked(leadImportService.validateRows).mockReset();
    vi.mocked(leadImportService.commitImport).mockReset();
  });

  it('renders the template download button and does not render astuce hint text', () => {
    renderPanel();
    const downloadLink = screen.getByRole('link', { name: /télécharger le modèle/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute('href', '/templates/leads-import-template.xlsx');

    // Verify button styling/component presence
    const downloadButton = screen.getByRole('button', { name: /télécharger le modèle/i });
    expect(downloadButton).toBeInTheDocument();

    // Verify astuce text is removed
    expect(screen.queryByText(/astuce/i)).not.toBeInTheDocument();
  });

  it('parses the selected file, shows a preview summary, then commits on confirm', async () => {
    vi.mocked(leadImportService.parseFile).mockResolvedValue([{ rowNumber: 2 } as any]);
    vi.mocked(leadImportService.fetchExistingLeadsByEmail).mockResolvedValue(new Map());
    vi.mocked(leadImportService.getProspectStageId).mockResolvedValue('stage-1');
    vi.mocked(leadImportService.validateRows).mockReturnValue({
      toCreate: [{ rowNumber: 2, payload: {} as any }],
      toUpdate: [],
      errors: [{ rowNumber: 3, reason: 'Nom de société manquant' }],
    });
    vi.mocked(leadImportService.commitImport).mockResolvedValue({ created: 1, updated: 0 });

    renderPanel();

    const file = new File(['dummy'], 'leads.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByLabelText(/glissez/i), { target: { files: [file] } });

    await waitFor(() => expect(leadImportService.validateRows).toHaveBeenCalled());
    expect(screen.getByText('Lead(s) prêt(s) à être créé(s)')).toBeInTheDocument();
    expect(screen.getByText('Erreur(s)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Confirmer l'import" }));

    await waitFor(() =>
      expect(leadImportService.commitImport).toHaveBeenCalledWith(
        [{ rowNumber: 2, payload: {} }],
        []
      )
    );
    expect(await screen.findByText('1 lead(s) créé(s), 0 mis à jour')).toBeInTheDocument();
  });

  it('shows an error toast and returns to the select step when commitImport reports a mid-loop failure', async () => {
    vi.mocked(leadImportService.parseFile).mockResolvedValue([{ rowNumber: 2 } as any]);
    vi.mocked(leadImportService.fetchExistingLeadsByEmail).mockResolvedValue(new Map());
    vi.mocked(leadImportService.getProspectStageId).mockResolvedValue('stage-1');
    vi.mocked(leadImportService.validateRows).mockReturnValue({
      toCreate: [{ rowNumber: 2, payload: {} as any }],
      toUpdate: [],
      errors: [],
    });
    vi.mocked(leadImportService.commitImport).mockResolvedValue({
      created: 2,
      updated: 1,
      error: 'insert failed: constraint violation',
    });

    renderPanel();

    const file = new File(['dummy'], 'leads.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByLabelText(/glissez/i), { target: { files: [file] } });

    await waitFor(() => expect(leadImportService.validateRows).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: "Confirmer l'import" }));

    await waitFor(() => expect(leadImportService.commitImport).toHaveBeenCalled());

    expect(
      await screen.findByText(
        "Import interrompu après 2 création(s) et 1 mise(s) à jour — vérifiez le pipeline avant de réessayer."
      )
    ).toBeInTheDocument();

    // Returned to the select step (stale toCreate/toUpdate can't be replayed) rather than showing 'done'.
    expect(screen.queryByText(/lead\(s\) créé\(s\), \d+ mis à jour/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/glissez/i)).toBeInTheDocument();
  });
});
