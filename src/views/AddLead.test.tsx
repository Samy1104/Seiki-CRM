// Projet/src/views/AddLead.test.tsx
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddLead } from './AddLead';

vi.mock('../hooks/useAddLeadForm', () => ({
  useAddLeadForm: () => ({
    form: {},
    setForm: vi.fn(),
    scores: {},
    handleScoreChange: vi.fn(),
    customFields: [],
    addCustomField: vi.fn(),
    updateCustomField: vi.fn(),
    removeCustomField: vi.fn(),
    stages: [],
    totalScore: 0,
    recommendation: { text: '', className: '' },
    handleReset: vi.fn(),
    handleSubmit: vi.fn(),
  }),
}));

vi.mock('./addlead/LeadGeneralInfoSection', () => ({
  LeadGeneralInfoSection: () => <div data-testid="single-lead-form" />,
}));
vi.mock('./addlead/LeadScoringSection', () => ({
  LeadScoringSection: () => <div data-testid="scoring-section" />,
}));
vi.mock('./addlead/BulkImportPanel', () => ({
  BulkImportPanel: () => <div data-testid="bulk-import-panel" />,
}));

describe('AddLead', () => {
  it('defaults to the single-lead form and switches to bulk import when toggled', () => {
    render(<AddLead setView={vi.fn()} />);

    expect(screen.getByTestId('single-lead-form')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-import-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /import en masse/i }));

    expect(screen.getByTestId('bulk-import-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('single-lead-form')).not.toBeInTheDocument();
  });
});
