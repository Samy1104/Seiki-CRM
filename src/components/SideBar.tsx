import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { leadsService } from '../services/leadsService';
import { tasksService } from '../services/tasksService';
import { Badge } from './ui/Badge';
import {
  KanbanSquare,
  Users,
  Sliders,
  CheckSquare,
  Calendar,
  BarChart3,
  Target,
  Settings,
  LogOut,
  LayoutGrid,
  Menu,
  X,
} from 'lucide-react';

interface SideBarProps {
  currentView: string;
  setView: (view: string) => void;
  setActiveApp?: (app: 'portal' | 'crm' | 'contenu') => void;
}

const navItems = [
  { id: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { id: 'leads', label: 'Tous les leads', icon: Users },
  { id: 'add', label: 'Ajouter / Scorer', icon: Sliders },
  { id: 'tasks', label: 'Tâches', icon: CheckSquare },
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'stats', label: 'Statistiques', icon: BarChart3 },
  { id: 'codir', label: 'Dashboard CODIR', icon: Target, isCodir: true },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export const SideBar: React.FC<SideBarProps> = ({ currentView, setView, setActiveApp }) => {
  const { logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stats, setStats] = useState({ leadsCount: 0, totalVal: 0, avgScore: 0, pendingTasks: 0 });

  const loadStats = async () => {
    try {
      const leads = await leadsService.getLeads();
      const tasks = await tasksService.getTasks();

      const val = leads.reduce((acc, l) => acc + l.deal_value, 0);
      const avg = leads.length ? Math.round(leads.reduce((acc, l) => acc + l.score, 0) / leads.length) : 0;
      const pending = tasks.filter(t => t.status !== 'done').length;

      setStats({ leadsCount: leads.length, totalVal: val, avgScore: avg, pendingTasks: pending });
    } catch (err) {
      console.error('Error loading sidebar stats:', err);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [currentView]);

  const handleNavClick = (id: string) => {
    setView(id);
    setDrawerOpen(false);
  };

  const renderNav = (showLabels: boolean) => (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = currentView === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={[
              'relative flex items-center gap-3 rounded-sm border border-transparent px-3 py-2.5 text-left font-ui text-[13px] font-medium transition-colors cursor-pointer',
              isActive ? 'bg-amber-soft text-ink border-line-focus' : 'text-ink-soft hover:bg-hover hover:text-ink',
              showLabels ? '' : 'justify-center',
            ].join(' ')}
            title={showLabels ? undefined : item.label}
          >
            <Icon size={16} />
            {showLabels && <span>{item.label}</span>}
            {showLabels && item.id === 'tasks' && stats.pendingTasks > 0 && (
              <Badge tone="danger" className="ml-auto">{stats.pendingTasks}</Badge>
            )}
          </button>
        );
      })}
    </nav>
  );

  const footer = (showLabels: boolean) => (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      {showLabels && (
        <>
          <div className="text-[11px] text-ink-soft">Leads : <strong className="text-ink">{stats.leadsCount}</strong></div>
          <div className="text-[11px] text-ink-soft">Pipeline : <strong className="text-ink">{stats.totalVal}k€</strong></div>
          <div className="text-[11px] text-ink-soft">Score moyen : <strong className="text-ink">{stats.avgScore}/100</strong></div>
        </>
      )}

      {setActiveApp && (
        <button
          className="flex items-center justify-center gap-1.5 rounded-sm border border-line-strong py-1.5 text-[11px] text-ink-soft transition-colors hover:bg-hover cursor-pointer"
          onClick={() => setActiveApp('portal')}
        >
          <LayoutGrid size={14} />
          {showLabels && 'Retour Portail'}
        </button>
      )}

      <button
        className="flex items-center justify-center gap-1.5 rounded-sm border border-line-strong py-1.5 text-[11px] text-ink-soft transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger cursor-pointer"
        onClick={logout}
      >
        <LogOut size={14} />
        {showLabels && 'Déconnexion'}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger — visible only below md */}
      <button
        className="fixed left-4 top-4 z-40 rounded-sm border border-line-strong bg-surface p-2 text-ink md:hidden cursor-pointer"
        onClick={() => setDrawerOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu size={18} />
      </button>

      {/* Tablet icon-rail (md–lg) + desktop full nav (lg+) */}
      <aside className="hidden h-screen w-16 flex-shrink-0 flex-col border-r border-line bg-surface p-3 md:flex lg:hidden">
        {renderNav(false)}
        {footer(false)}
      </aside>
      <aside className="hidden h-screen w-60 flex-shrink-0 flex-col border-r border-line bg-surface p-5 lg:flex">
        <div className="mb-6 border-b border-line pb-4">
          <img src="/grand_logo.png" alt="Seiki" className="h-8 w-auto" />
          <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wide text-ink-faint">
            CRM — Mobilité intelligente
          </div>
        </div>
        {renderNav(true)}
        {footer(true)}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" data-testid="sidebar-drawer">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-surface p-5">
            <button
              className="absolute right-4 top-4 text-ink-soft cursor-pointer"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
            <div className="mb-6 border-b border-line pb-4">
              <img src="/grand_logo.png" alt="Seiki" className="h-8 w-auto" />
            </div>
            {renderNav(true)}
            {footer(true)}
          </aside>
        </div>
      )}
    </>
  );
};
