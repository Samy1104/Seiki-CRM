import React from "react";

interface AgendaTabsProps {
  activeTab: "upcoming" | "past";
  setActiveTab: (tab: "upcoming" | "past") => void;
  upcomingCount: number;
  pastCount: number;
}

export const AgendaTabs: React.FC<AgendaTabsProps> = ({
  activeTab,
  setActiveTab,
  upcomingCount,
  pastCount,
}) => {
  const tabs = [
    { key: "upcoming" as const, label: "À venir", count: upcomingCount },
    { key: "past" as const, label: "Historique", count: pastCount },
  ];

  return (
    <div className="flex" style={{ borderBottom: "1px solid rgba(242,237,228,0.08)" }}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-2 py-3 transition-colors duration-150 cursor-pointer"
            style={{
              borderBottom: `1px solid ${active ? "var(--color-beige, #D4C4A8)" : "transparent"}`,
              marginBottom: "-1px",
              color: active ? "var(--color-charcoal-fg, #f2ede4)" : "#555",
            }}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.color = "var(--color-charcoal-fg-soft, #b0afa8)";
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.color = "#555";
            }}
          >
            <span className="text-[11px] tracking-[0.2em] uppercase font-medium">
              {tab.label}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5"
              style={{
                background: active ? "rgba(200,184,154,0.15)" : "rgba(242,237,228,0.05)",
                color: active ? "var(--color-beige, #D4C4A8)" : "#444",
              }}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
