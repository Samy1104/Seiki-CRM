import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import {
  GitBranch,
  Users,
  CheckSquare,
  Calendar,
  BarChart2,
  LayoutDashboard,
  FileText,
  Target,
  LogOut,
  Settings,
  ArrowLeft,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

type Section = "crm" | "contenu";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const crmNav: NavItem[] = [
  { id: "pipeline", label: "Pipeline", icon: <GitBranch size={16} strokeWidth={1.5} /> },
  { id: "leads", label: "Leads", icon: <Users size={16} strokeWidth={1.5} /> },
  { id: "tasks", label: "Tâches", icon: <CheckSquare size={16} strokeWidth={1.5} /> },
  { id: "agenda", label: "Agenda", icon: <Calendar size={16} strokeWidth={1.5} /> },
  { id: "stats", label: "Statistiques", icon: <BarChart2 size={16} strokeWidth={1.5} /> },
  { id: "codir", label: "Dashboard CODIR", icon: <LayoutDashboard size={16} strokeWidth={1.5} /> },
];

const contenuNav: NavItem[] = [
  { id: "linkedin", label: "Posts", icon: <FileText size={16} strokeWidth={1.5} /> },
  { id: "prospection", label: "Prospection", icon: <Target size={16} strokeWidth={1.5} /> },
];

export interface SidebarProps {
  section: Section;
  currentView?: string;
  setView?: (view: string) => void;
  contenuView?: 'linkedin' | 'prospection';
  setContenuView?: (view: 'linkedin' | 'prospection') => void;
  setActiveApp?: (app: 'portal' | 'crm' | 'contenu') => void;
}

const navItemClass = (active: boolean, collapsed: boolean) =>
  [
    "flex items-center gap-3 w-full rounded-md text-left transition-colors cursor-pointer",
    collapsed ? "py-3 justify-center" : "py-3 px-3 justify-start",
    active ? "bg-charcoal-fg/6 text-charcoal-fg" : "text-charcoal-fg-soft hover:text-charcoal-fg",
  ].join(" ");

const submenuItemClass = (isFloating: boolean, danger?: boolean) =>
  [
    "flex items-center gap-3 w-full text-left bg-transparent border-none cursor-pointer text-[13px] transition-colors",
    isFloating ? "py-[0.6rem] px-4" : "py-[0.6rem] px-3",
    danger ? "text-charcoal-fg-soft hover:text-charcoal-danger" : "text-charcoal-fg-soft hover:text-charcoal-fg",
  ].join(" ");

export const Sidebar: React.FC<SidebarProps> = ({
  section,
  currentView,
  setView,
  contenuView,
  setContenuView,
  setActiveApp,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const navItems = section === "crm" ? crmNav : contenuNav;

  // Determine active item based on current URL path or passed props fallback
  const getActiveId = () => {
    const path = location.pathname;
    if (section === "crm") {
      if (path.includes("/crm/leads")) return "leads";
      if (path.includes("/crm/tasks")) return "tasks";
      if (path.includes("/crm/agenda")) return "agenda";
      if (path.includes("/crm/stats")) return "stats";
      if (path.includes("/crm/codir")) return "codir";
      if (path.includes("/crm/settings")) return "settings";
      if (path.includes("/crm/pipeline")) return "pipeline";
      return currentView || "pipeline";
    } else {
      if (path.includes("/contenu/prospection")) return "prospection";
      if (path.includes("/contenu/linkedin")) return "linkedin";
      return contenuView || "linkedin";
    }
  };

  const activeId = getActiveId();

  function handleNavClick(id: string) {
    if (section === "crm") {
      if (setView) setView(id);
      navigate(`/crm/${id}`);
    } else if (section === "contenu") {
      if (setContenuView) setContenuView(id as 'linkedin' | 'prospection');
      navigate(`/contenu/${id}`);
    }
  }

  function handleAvatarClick() {
    if (collapsed && avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom, left: rect.right + 8 });
    }
    setProfileOpen((v) => !v);
  }

  useEffect(() => {
    if (!profileOpen || !collapsed) return;
    function onDown(e: MouseEvent) {
      if (
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileOpen, collapsed]);

  const displayName = user?.full_name || (user?.email ? user.email.split("@")[0] : "Jean Dupont");
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "JD";

  const submenuItems = (isFloating: boolean) => (
    <div>
      {isFloating && <div className="h-1" />}
      <button
        className={submenuItemClass(isFloating)}
        onClick={() => {
          setProfileOpen(false);
          if (setActiveApp) setActiveApp("portal");
          navigate("/portal");
        }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        <span className="whitespace-nowrap">Retour au portail</span>
      </button>
      <button
        className={submenuItemClass(isFloating)}
        onClick={() => {
          setProfileOpen(false);
          if (setActiveApp) setActiveApp("crm");
          if (setView) setView("settings");
          navigate("/crm/settings");
        }}
      >
        <Settings size={14} strokeWidth={1.5} />
        <span className="whitespace-nowrap">Paramètres</span>
      </button>
      <div className="h-px bg-charcoal-fg/6 my-1" />
      <button
        className={submenuItemClass(isFloating, true)}
        onClick={() => { setProfileOpen(false); logout(); }}
      >
        <LogOut size={14} strokeWidth={1.5} />
        <span className="whitespace-nowrap">Se déconnecter</span>
      </button>
      {isFloating && <div className="h-1" />}
    </div>
  );

  return (
    <aside
      className={`flex flex-col h-screen shrink-0 relative overflow-hidden transition-[width] duration-300 ease-in-out bg-charcoal border-r border-charcoal-fg/8 font-['Inter',sans-serif] ${collapsed ? "w-14" : "w-[220px]"}`}
    >
      {/* Logo + collapse toggle */}
      <div
        className={`flex items-center border-b border-charcoal-fg/6 transition-[padding] duration-300 ease-in-out shrink-0 ${collapsed ? "justify-center py-5" : "justify-between px-5 py-5"}`}
      >
        {!collapsed && (
          <img src="/grand_logo.png" alt="Company logo" className="h-8 w-auto object-contain" />
        )}
        <button
          onClick={() => { setCollapsed((v) => !v); setProfileOpen(false); }}
          className="flex items-center justify-center border-none bg-transparent p-1 leading-none text-charcoal-fg-soft transition-colors cursor-pointer hover:text-charcoal-fg"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <PanelLeftOpen size={20} strokeWidth={1.5} />
            : <PanelLeftClose size={20} strokeWidth={1.5} />
          }
        </button>
      </div>

      {/* Nav items */}
      <nav className={`flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden pt-4 ${collapsed ? "px-2" : "px-3"}`}>
        {navItems.map((item) => {
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={collapsed ? item.label : undefined}
              className={navItemClass(active, collapsed)}
            >
              <span className={`flex shrink-0 items-center ${active ? "text-beige" : ""}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className={`text-sm tracking-[0.01em] whitespace-nowrap ${active ? "font-medium" : "font-normal"}`}>
                  {item.label}
                </span>
              )}
              {!collapsed && active && (
                <span className="ml-auto block h-1 w-1 shrink-0 rounded-full bg-beige" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto shrink-0 border-t border-charcoal-fg/6">

        {/* Inline submenu (expanded state) */}
        {profileOpen && !collapsed && (
          <div className="border-b border-charcoal-fg/6 px-3 pb-1">
            {submenuItems(false)}
          </div>
        )}

        {/* Profile row */}
        <button
          ref={avatarRef}
          title={collapsed ? displayName : undefined}
          onClick={handleAvatarClick}
          className={`flex w-full items-center gap-3 border-none bg-transparent text-left transition-colors cursor-pointer ${collapsed ? "justify-center py-4" : "justify-start px-5 py-4"} ${profileOpen ? "text-charcoal-fg" : "text-charcoal-fg-soft hover:text-charcoal-fg"}`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-charcoal-fg/10 text-[11px] font-medium text-charcoal-fg">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={displayName} className="h-full w-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 overflow-hidden text-left">
                <div className="truncate text-[13px] font-medium capitalize tracking-[0.01em] text-charcoal-fg">
                  {displayName}
                </div>
              </div>
              <ChevronUp
                size={12}
                strokeWidth={1.5}
                className={`shrink-0 transition-transform duration-200 ${profileOpen ? "rotate-0" : "rotate-180"}`}
              />
            </>
          )}
        </button>

        {/* Powered by */}
        {!collapsed && (
          <div className="pb-4 text-center text-beige">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em]">
              Powered by Seiki
            </span>
          </div>
        )}
      </div>

      {/* Floating submenu portal (collapsed state) */}
      {profileOpen && collapsed && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-[200px] overflow-hidden border-b border-r border-t border-charcoal-fg/6 border-t-charcoal-fg/10 bg-charcoal shadow-[4px_4px_32px_rgba(0,0,0,0.6)]"
          style={{
            bottom: `calc(100vh - ${menuPos.top}px)`,
            left: menuPos.left,
          }}
        >
          {submenuItems(true)}
        </div>,
        document.body
      )}
    </aside>
  );
};
