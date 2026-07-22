import { useState, useEffect } from 'react';
import type { ColWidths } from '../views/tasks/TaskListView';

const COL_KEYS: (keyof ColWidths)[] = ['name', 'assignee', 'date', 'priority', 'lead'];

const computeDefaultColWidths = (): ColWidths => {
  const availableWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 80, 1550) : 1400;
  const usableWidth = Math.max(900, availableWidth - 118);

  return {
    name: Math.floor(usableWidth * 0.48),
    assignee: Math.floor(usableWidth * 0.13),
    date: Math.floor(usableWidth * 0.13),
    priority: Math.floor(usableWidth * 0.13),
    lead: Math.floor(usableWidth * 0.13),
  };
};

const getInitialColWidths = (): ColWidths => {
  const defaults = computeDefaultColWidths();

  try {
    const saved = localStorage.getItem('tasksColWidths_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = { ...defaults };
      for (const key of COL_KEYS) {
        if (typeof parsed?.[key] === 'number' && Number.isFinite(parsed[key])) {
          merged[key] = parsed[key];
        }
      }
      return merged;
    }
  } catch (err) {
    console.error('Error reading saved col widths', err);
  }

  return defaults;
};

export function useTaskColWidths() {
  const [colWidths, setColWidths] = useState<ColWidths>(getInitialColWidths);

  useEffect(() => {
    localStorage.setItem('tasksColWidths_v2', JSON.stringify(colWidths));
  }, [colWidths]);

  return { colWidths, setColWidths };
}
