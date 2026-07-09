import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel
} from './Select';

const TestSelect = ({ defaultValue, onValueChange }: { defaultValue?: string, onValueChange?: (val: string) => void }) => {
  const [val, setVal] = useState(defaultValue);
  return (
    <Select
      value={val}
      onValueChange={(newVal) => {
        setVal(newVal);
        onValueChange?.(newVal);
      }}
    >
      <SelectTrigger data-testid="select-trigger">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="blueberry" disabled>Blueberry</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

describe('Select Component', () => {
  it('renders with placeholder when no value is selected', () => {
    render(<TestSelect />);
    expect(screen.getByText('Select a fruit')).toBeInTheDocument();
  });

  it('renders selected item label when defaultValue is provided', () => {
    render(<TestSelect defaultValue="banana" />);
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('opens dropdown content when clicked', () => {
    render(<TestSelect />);
    const trigger = screen.getByTestId('select-trigger');
    
    // Content should not be in the document (or not visible) initially
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    
    fireEvent.click(trigger);
    
    // Content should be visible
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Fruits')).toBeInTheDocument();
  });

  it('selects option on click and closes dropdown', () => {
    const handleValueChange = vi.fn();
    render(<TestSelect onValueChange={handleValueChange} />);
    
    const trigger = screen.getByTestId('select-trigger');
    fireEvent.click(trigger);
    
    const option = screen.getByText('Apple');
    fireEvent.click(option);
    
    expect(handleValueChange).toHaveBeenCalledWith('apple');
    expect(trigger).toHaveTextContent('Apple');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('handles keyboard navigation (ArrowDown, ArrowUp, Enter)', () => {
    const handleValueChange = vi.fn();
    render(<TestSelect onValueChange={handleValueChange} />);
    
    const trigger = screen.getByTestId('select-trigger');
    trigger.focus();
    
    // Open using ArrowDown
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByText('Apple')).toBeInTheDocument();
    
    // First option (Apple) should be highlighted
    // Press ArrowDown to move highlight to Banana
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    
    // Press Enter to select
    fireEvent.keyDown(trigger, { key: 'Enter' });
    
    expect(handleValueChange).toHaveBeenCalledWith('banana');
    expect(trigger).toHaveTextContent('Banana');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on clicking outside', () => {
    render(<TestSelect />);
    const trigger = screen.getByTestId('select-trigger');
    
    fireEvent.click(trigger);
    expect(screen.getByText('Apple')).toBeInTheDocument();
    
    // Click outside
    fireEvent.mouseDown(document.body);
    
    // Should close
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
