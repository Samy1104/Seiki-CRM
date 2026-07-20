export function getPriorityInfo(priority: string | null) {
  switch (priority) {
    case 'high': return { label: 'Urgent', color: 'var(--red)', bg: 'rgba(248, 113, 113, 0.12)' };
    case 'medium': return { label: 'Normal', color: 'var(--color-amber)', bg: 'rgba(245, 158, 11, 0.12)' };
    case 'low': return { label: 'Basse', color: 'var(--green)', bg: 'rgba(74, 222, 128, 0.12)' };
    default: return { label: 'Sans', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)' };
  }
}
