import { useState, useEffect } from 'react';
import type { ColWidths } from '../views/tasks/TaskListView';

const COL_KEYS: (keyof ColWidths)[] = ['name', 'assignee', 'date', 'priority', 'lead'];

const computeDefaultColWidths = (): ColWidths => {
  const availableWidth = typeof window !== 'undefined' ? window.innerWidth - 320 : 1200;
  const dynamicWidth = Math.max(800, availableWidth - 118 - 32);

  return {
    name: Math.floor(dynamicWidth * (1.8 / 6)),
    assignee: Math.floor(dynamicWidth * (1 / 6)),
    date: Math.floor(dynamicWidth * (1 / 6)),
    priority: Math.floor(dynamicWidth * (1 / 6)),
    lead: Math.floor(dynamicWidth * (1.2 / 6)),
  };
};

const getInitialColWidths = (): ColWidths => {
  const defaults = computeDefaultColWidths();

  try {
    const saved = localStorage.getItem('tasksColWidths');
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
    localStorage.setItem('tasksColWidths', JSON.stringify(colWidths));
  }, [colWidths]);

  return { colWidths, setColWidths };
}
