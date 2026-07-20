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
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const navItems = section === "crm" ? crmNav : contenuNav;
  const activeId = section === "crm" ? currentView : contenuView;
  const accentColor = section === "crm" ? "#c8b89a" : "#c8b89a";

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
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {isFloating && <div style={{ height: "4px" }} />}
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          textAlign: "left",
          color: "#b0afa8",
          padding: isFloating ? "0.6rem 1rem" : "0.6rem 0.75rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          fontFamily: "'Inter', sans-serif",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#b0afa8")}
        onClick={() => { setProfileOpen(false); setActiveApp("portal"); }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        <span style={{ whiteSpace: "nowrap" }}>Retour au portail</span>
      </button>
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          textAlign: "left",
          color: "#b0afa8",
          padding: isFloating ? "0.6rem 1rem" : "0.6rem 0.75rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          fontFamily: "'Inter', sans-serif",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#b0afa8")}
        onClick={() => {
          setProfileOpen(false);
          setActiveApp("crm");
          if (setView) setView("settings");
        }}
      >
        <Settings size={14} strokeWidth={1.5} />
        <span style={{ whiteSpace: "nowrap" }}>Paramètres</span>
      </button>
      <div style={{ height: "1px", background: "rgba(242, 237, 228, 0.06)", margin: "4px 0" }} />
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          textAlign: "left",
          color: "#b0afa8",
          padding: isFloating ? "0.6rem 1rem" : "0.6rem 0.75rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          fontFamily: "'Inter', sans-serif",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e05252")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#b0afa8")}
        onClick={() => { setProfileOpen(false); logout(); }}
      >
        <LogOut size={14} strokeWidth={1.5} />
        <span style={{ whiteSpace: "nowrap" }}>Se déconnecter</span>
      </button>
      {isFloating && <div style={{ height: "4px" }} />}
    </div>
  );

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: collapsed ? "56px" : "220px",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        background: "#0d0d0d",
        borderRight: "1px solid rgba(242, 237, 228, 0.08)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? "1.25rem 0 1.25rem" : "1.25rem 1.25rem",
          borderBottom: "1px solid rgba(242, 237, 228, 0.06)",
          transition: "padding 0.3s ease",
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <img
            src="/grand_logo.png"
            alt="Company logo"
            style={{ height: "32px", width: "auto", objectFit: "contain" }}
          />
        )}
        <button
          onClick={() => { setCollapsed((v) => !v); setProfileOpen(false); }}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#b0afa8",
            lineHeight: 0,
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "color 0.15s ease",
          }}
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
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          padding: collapsed ? "1rem 8px 0" : "1rem 0.75rem 0",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {navItems.map((item) => {
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: collapsed ? "0.75rem 0" : "0.75rem 0.75rem",
                justifyContent: collapsed ? "center" : "flex-start",
                background: active ? "rgba(242, 237, 228, 0.06)" : "transparent",
                color: active ? "#f2ede4" : "#b0afa8",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "#f2ede4";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "#b0afa8";
              }}
            >
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0, color: active ? accentColor : "inherit" }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span style={{ fontSize: "14px", fontWeight: active ? 500 : 400, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              )}
              {!collapsed && active && (
                <span
                  style={{
                    marginLeft: "auto",
                    display: "block",
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: accentColor,
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ marginTop: "auto", flexShrink: 0, borderTop: "1px solid rgba(242, 237, 228, 0.06)" }}>

        {/* Inline submenu (expanded state) */}
        {profileOpen && !collapsed && (
          <div
            style={{ padding: "0 12px 4px", borderBottom: "1px solid rgba(242, 237, 228, 0.06)" }}
          >
            {submenuItems(false)}
          </div>
        )}

        {/* Profile row */}
        <button
          ref={avatarRef}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            padding: collapsed ? "1rem 0" : "1rem 1.25rem",
            justifyContent: collapsed ? "center" : "flex-start",
            color: profileOpen ? "#f2ede4" : "#b0afa8",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            transition: "color 0.15s ease",
          }}
          title={collapsed ? displayName : undefined}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
          onMouseLeave={(e) => {
            if (!profileOpen) (e.currentTarget as HTMLElement).style.color = "#b0afa8";
          }}
          onClick={handleAvatarClick}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "11px",
              fontWeight: 500,
              background: "rgba(242, 237, 228, 0.1)",
              color: "#f2ede4",
              overflow: "hidden",
            }}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              initials
            )}
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#f2ede4", whiteSpace: "nowrap", textTransform: "capitalize", letterSpacing: "0.01em" }}>
                  {displayName}
                </div>
              </div>
              <ChevronUp
                size={12}
                strokeWidth={1.5}
                style={{
                  flexShrink: 0,
                  transform: profileOpen ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </>
          )}
        </button>

        {/* Powered by */}
        {!collapsed && (
          <div style={{ paddingBottom: "16px", textAlign: "center", color: "#c8b89a" }}>
            <span style={{ fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500 }}>
              Powered by Seiki
            </span>
          </div>
        )}
      </div>

      {/* Floating submenu portal (collapsed state) */}
      {profileOpen && collapsed && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            overflow: "hidden",
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
