import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  setActiveApp: (app: 'portal' | 'crm' | 'contenu') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  section,
  currentView,
  setView,
  contenuView,
  setContenuView,
  setActiveApp,
}) => {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const navItems = section === "crm" ? crmNav : contenuNav;
  const activeId = section === "crm" ? currentView : contenuView;
  const accentColor = section === "crm" ? "#c8b89a" : "#5b5bd6";

  function handleNavClick(id: string) {
    if (section === "crm" && setView) {
      setView(id);
    } else if (section === "contenu" && setContenuView) {
      setContenuView(id as 'linkedin' | 'prospection');
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
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileOpen, collapsed]);

  const displayName = user?.email ? user.email.split("@")[0] : "Jean Dupont";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "JD";

  const submenuItems = (isFloating: boolean) => (
    <div style={isFloating ? { fontFamily: "'Inter', sans-serif" } : {}}>
      {isFloating && <div style={{ height: "4px" }} />}
      <button
        className="flex items-center gap-3 w-full text-left transition-colors duration-150 cursor-pointer"
        style={{ color: "#b0afa8", padding: isFloating ? "0.6rem 1rem" : "0.6rem 0.75rem" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#b0afa8")}
        onClick={() => { setProfileOpen(false); setActiveApp("portal"); }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        <span className="text-[13px] tracking-wide whitespace-nowrap">Retour au portail</span>
      </button>
      <button
        className="flex items-center gap-3 w-full text-left transition-colors duration-150 cursor-pointer"
        style={{ color: "#b0afa8", padding: isFloating ? "0.6rem 1rem" : "0.6rem 0.75rem" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#b0afa8")}
        onClick={() => {
          setProfileOpen(false);
          setActiveApp("crm");
          if (setView) setView("settings");
        }}
      >
        <Settings size={14} strokeWidth={1.5} />
        <span className="text-[13px] tracking-wide whitespace-nowrap">Paramètres</span>
      </button>
      <div style={{ height: "1px", background: "rgba(242, 237, 228, 0.06)", margin: "4px 0" }} />
      <button
        className="flex items-center gap-3 w-full text-left transition-colors duration-150 cursor-pointer"
        style={{ color: "#b0afa8", padding: isFloating ? "0.6rem 1rem" : "0.6rem 0.75rem" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e05252")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#b0afa8")}
        onClick={() => { setProfileOpen(false); logout(); }}
      >
        <LogOut size={14} strokeWidth={1.5} />
        <span className="text-[13px] tracking-wide whitespace-nowrap">Se déconnecter</span>
      </button>
      {isFloating && <div style={{ height: "4px" }} />}
    </div>
  );

  return (
    <aside
      className="flex flex-col h-full shrink-0 relative overflow-hidden"
      style={{
        width: collapsed ? "56px" : "220px",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        background: "#0d0d0d",
        borderRight: "1px solid rgba(242, 237, 228, 0.08)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        className="flex items-center shrink-0"
        style={{
          borderBottom: "1px solid rgba(242, 237, 228, 0.06)",
          padding: collapsed ? "1.5rem 0 1.25rem" : "1.5rem 1.25rem 1.25rem",
          justifyContent: collapsed ? "center" : "space-between",
          transition: "padding 0.3s ease",
        }}
      >
        {!collapsed && (
          <img
            src="/grand_logo.png"
            alt="Company logo"
            className="h-8 w-auto object-contain"
          />
        )}
        <button
          onClick={() => { setCollapsed((v) => !v); setProfileOpen(false); }}
          className="shrink-0 transition-colors duration-150 cursor-pointer"
          style={{ color: "#b0afa8", lineHeight: 0 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#b0afa8")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <PanelLeftOpen size={20} strokeWidth={1.5} />
            : <PanelLeftClose size={20} strokeWidth={1.5} />
          }
        </button>
      </div>

      {/* Nav items */}
      <nav
        className="flex-1 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden"
        style={{ padding: collapsed ? "1rem 8px 0" : "1rem 0.75rem 0" }}
      >
        {navItems.map((item) => {
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center gap-3 py-3 text-left transition-all duration-150 rounded-sm cursor-pointer"
              style={{
                padding: collapsed ? "0.75rem 0" : "0.75rem 0.75rem",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active ? "rgba(242, 237, 228, 0.06)" : "transparent",
                color: active ? "#f2ede4" : "#b0afa8",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "#f2ede4";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "#b0afa8";
              }}
            >
              <span className="shrink-0" style={{ color: active ? accentColor : "inherit" }}>{item.icon}</span>
              {!collapsed && (
                <span className="text-[14px] tracking-wide whitespace-nowrap">{item.label}</span>
              )}
              {!collapsed && active && (
                <span
                  className="ml-auto block w-1 h-1 rounded-full shrink-0"
                  style={{ background: accentColor }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto shrink-0" style={{ borderTop: "1px solid rgba(242, 237, 228, 0.06)" }}>

        {/* Inline submenu (expanded state) */}
        {profileOpen && !collapsed && (
          <div
            className="px-3 pb-1"
            style={{ borderBottom: "1px solid rgba(242, 237, 228, 0.06)" }}
          >
            {submenuItems(false)}
          </div>
        )}

        {/* Profile row */}
        <button
          ref={avatarRef}
          className="w-full flex items-center gap-3 py-4 transition-colors duration-150 cursor-pointer"
          style={{
            padding: collapsed ? "1rem 0" : "1rem 1.25rem",
            justifyContent: collapsed ? "center" : "flex-start",
            color: profileOpen ? "#f2ede4" : "#b0afa8",
          }}
          title={collapsed ? displayName : undefined}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
          onMouseLeave={(e) => {
            if (!profileOpen) (e.currentTarget as HTMLElement).style.color = "#b0afa8";
          }}
          onClick={handleAvatarClick}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-medium"
            style={{ background: "rgba(242, 237, 228, 0.1)", color: "#f2ede4" }}
          >
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 text-left overflow-hidden">
                <div className="text-[13px] tracking-wide text-[#f2ede4] whitespace-nowrap capitalize">{displayName}</div>
              </div>
              <ChevronUp
                size={12}
                strokeWidth={1.5}
                className="shrink-0"
                style={{
                  transform: profileOpen ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </>
          )}
        </button>

        {/* Powered by */}
        {!collapsed && (
          <div className="pb-4 text-center" style={{ color: "#c8b89a" }}>
            <span className="text-[10px] tracking-[0.15em] uppercase">Powered by Seiki</span>
          </div>
        )}
      </div>

      {/* Floating submenu portal (collapsed state) */}
      {profileOpen && collapsed && createPortal(
        <div
          className="fixed overflow-hidden"
          style={{
            bottom: `calc(100vh - ${menuPos.top}px)`,
            left: menuPos.left,
            width: "200px",
            background: "#0d0d0d",
            borderTop: "1px solid rgba(242, 237, 228, 0.1)",
            borderRight: "1px solid rgba(242, 237, 228, 0.06)",
            borderBottom: "1px solid rgba(242, 237, 228, 0.06)",
            boxShadow: "4px 4px 32px rgba(0,0,0,0.6)",
            zIndex: 9999,
          }}
        >
          {submenuItems(true)}
        </div>,
        document.body
      )}
    </aside>
  );
};
