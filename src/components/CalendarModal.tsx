import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAYS_FR = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

interface CalendarModalProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  minDate?: string;
}

export default function CalendarModal({ value, onChange, onClose, anchorRef, minDate }: CalendarModalProps) {
  const today = new Date();
  const initial = value ? new Date(value + "T12:00:00") : today;

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 260) });
    }
  }, [anchorRef]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  // Monday-first: 0=Mon … 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = i - startOffset + 1;
    cells.push(d >= 1 && d <= lastDay.getDate() ? d : null);
  }

  function selectDay(day: number) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${mm}-${dd}`;
    if (minDate && dateStr < minDate) return;
    onChange(dateStr);
    onClose();
  }

  function isSelected(day: number) {
    if (!value) return false;
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return value === `${viewYear}-${mm}-${dd}`;
  }

  function isToday(day: number) {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  }

  function isDisabled(day: number) {
    if (!minDate) return false;
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${viewYear}-${mm}-${dd}` < minDate;
  }

  return createPortal(
    <div
      ref={ref}
      className="fixed"
      style={{
        top: pos.top,
        left: pos.left,
        width: Math.max(pos.width, 264),
        background: "#111",
        borderTop: "1px solid var(--color-beige, #D4C4A8)",
        borderLeft: "1px solid rgba(242,237,228,0.08)",
        borderRight: "1px solid rgba(242,237,228,0.08)",
        borderBottom: "1px solid rgba(242,237,228,0.08)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
        zIndex: 9999,
        fontFamily: "'Inter', sans-serif",
        userSelect: "none",
      }}
    >
      {/* Month navigation */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid rgba(242,237,228,0.06)" }}
      >
        <button
          onClick={prevMonth}
          className="transition-colors duration-150"
          style={{ color: "#555", lineHeight: 0 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555")}
        >
          <ChevronLeft size={15} strokeWidth={1.5} />
        </button>

        <span
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: "1rem",
            color: "#f2ede4",
            letterSpacing: "-0.01em",
          }}
        >
          {MONTHS_FR[viewMonth]} {viewYear}
        </span>

        <button
          onClick={nextMonth}
          className="transition-colors duration-150"
          style={{ color: "#555", lineHeight: 0 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f2ede4")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555")}
        >
          <ChevronRight size={15} strokeWidth={1.5} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 pt-3 pb-1">
        {DAYS_FR.map((d) => (
          <div
            key={d}
            className="flex items-center justify-center py-1 text-[10px] tracking-[0.15em] uppercase"
            style={{ color: "#444" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 px-3 pb-4 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const selected = isSelected(day);
          const todayMark = isToday(day);
          const disabled = isDisabled(day);
          return (
            <button
              key={i}
              onClick={() => !disabled && selectDay(day)}
              className="flex items-center justify-center h-8 text-[13px] transition-all duration-100"
              style={{
                color: disabled ? "#2a2a2a" : selected ? "#0d0d0d" : todayMark ? "var(--color-beige, #D4C4A8)" : "#b0afa8",
                background: selected ? "var(--color-beige, #D4C4A8)" : "transparent",
                cursor: disabled ? "not-allowed" : "pointer",
                fontWeight: selected ? 600 : todayMark ? 500 : 400,
              }}
              onMouseEnter={(e) => {
                if (!disabled && !selected)
                  (e.currentTarget as HTMLElement).style.color = "#f2ede4";
              }}
              onMouseLeave={(e) => {
                if (!disabled && !selected)
                  (e.currentTarget as HTMLElement).style.color = todayMark ? "var(--color-beige, #D4C4A8)" : "#b0afa8";
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Clear */}
      {value && (
        <div
          className="px-5 py-3 flex justify-end"
          style={{ borderTop: "1px solid rgba(242,237,228,0.06)" }}
        >
          <button
            className="flex items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase transition-colors duration-150"
            style={{ color: "#555" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e05252")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555")}
            onClick={() => { onChange(""); onClose(); }}
          >
            <X size={11} strokeWidth={1.5} />
            Effacer
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
