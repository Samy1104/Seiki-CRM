import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { leadsService } from '../services/leadsService';
import { tasksService } from '../services/tasksService';
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
  LayoutGrid
} from 'lucide-react';

interface SideBarProps {
  currentView: string;
  setView: (view: string) => void;
  setActiveApp?: (app: 'portal' | 'crm' | 'contenu') => void;
}

export const SideBar: React.FC<SideBarProps> = ({ currentView, setView, setActiveApp }) => {
  const { logout } = useAuth();
  const [stats, setStats] = useState({
    leadsCount: 0,
    totalVal: 0,
    avgScore: 0,
    pendingTasks: 0
  });

  const loadStats = async () => {
    try {
      const leads = await leadsService.getLeads();
      const tasks = await tasksService.getTasks();

      const val = leads.reduce((acc, l) => acc + l.deal_value, 0);
      const avg = leads.length ? Math.round(leads.reduce((acc, l) => acc + l.score, 0) / leads.length) : 0;
      const pending = tasks.filter(t => t.status !== 'done').length;

      setStats({
        leadsCount: leads.length,
        totalVal: val,
        avgScore: avg,
        pendingTasks: pending
      });
    } catch (err) {
      console.error('Error loading sidebar stats:', err);
    }
  };

  useEffect(() => {
    loadStats();
    // Refresh stats every 10 seconds to keep up to date
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [currentView]);

  const navItems = [
    { id: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
    { id: 'leads', label: 'Tous les leads', icon: Users },
    { id: 'add', label: 'Ajouter / Scorer', icon: Sliders },
    { id: 'tasks', label: 'Tâches', icon: CheckSquare, badge: stats.pendingTasks },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'stats', label: 'Statistiques', icon: BarChart3 },
    { id: 'codir', label: 'Dashboard CODIR', icon: Target, isCodir: true },
    { id: 'settings', label: 'Paramètres', icon: Settings }
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark-wrap">
          <img src="/grand_logo.png" alt="Seiki" className="logo-mark" />
        </div>
        <div className="logo-sub">CRM — Mobilité intelligente</div>
      </div>
      
      <nav className="nav">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          let btnClass = 'nav-item';
          if (isActive) {
            btnClass += ' on';
          }
          if (item.isCodir) {
            btnClass += ' nav-item-codir';
          }
          if ((item as any).isAI) {
            btnClass += ' nav-item-ai';
          }

          return (
            <button 
              key={item.id} 
              className={btnClass} 
              onClick={() => setView(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="nav-badge">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      
      <div className="sidebar-footer">
        <div className="sidebar-stat">Leads : <strong>{stats.leadsCount}</strong></div>
        <div className="sidebar-stat">Pipeline : <strong>{stats.totalVal}k€</strong></div>
        <div className="sidebar-stat">Score moyen : <strong>{stats.avgScore}/100</strong></div>
        
        {setActiveApp && (
          <button className="btn-logout" style={{ marginBottom: '8px' }} onClick={() => setActiveApp('portal')}>
            <LayoutGrid size={14} style={{ marginRight: '6px' }} />
            Retour Portail
          </button>
        )}

        <button className="btn-logout" onClick={logout}>
          <LogOut size={14} style={{ marginRight: '6px' }} />
          Déconnexion
        </button>

        {/* Powered by Seiki Footer */}
        <div className="powered-by-seiki-footer">
          <span className="powered-text">Powered by</span>
          <img src="/seiki_logo_large.png" className="seiki-footer-logo" alt="Seiki Logo" />
          <span className="seiki-footer-name">Seiki</span>
        </div>
      </div>
    </aside>
  );
};
