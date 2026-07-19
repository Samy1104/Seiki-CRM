import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KpiTile } from './KpiTile';

describe('KpiTile', () => {
  it('renders the label and sub text immediately', () => {
    render(<KpiTile label="Pipeline" value={248} sub="Valeur totale" />);
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Valeur totale')).toBeInTheDocument();
  });

  it('counts up to the target value', async () => {
    render(<KpiTile label="Pipeline" value={248} />);
    await waitFor(
      () => expect(screen.getByTestId('kpi-value')).toHaveTextContent('248'),
      { timeout: 2000 }
    );
  });

  it('applies a custom formatter', async () => {
    render(<KpiTile label="Pipeline" value={248} formatValue={(v) => `${Math.round(v)}k€`} />);
    await waitFor(
      () => expect(screen.getByTestId('kpi-value')).toHaveTextContent('248k€'),
      { timeout: 2000 }
    );
  });
});
