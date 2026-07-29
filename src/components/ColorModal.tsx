import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";

const PRESET_COLORS = [
  "#6B5FE6", // Purple
  "#F59E0B", // Amber
  "#4ADE80", // Emerald Green
  "#EC4899", // Pink
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#10B981", // Teal
  "#F97316", // Orange
  "#E11D48", // Rose
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#D4C4A8", // Beige
  "#64748B", // Slate
  "#94A3B8", // Light Slate
];

interface ColorModalProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function ColorModal({ value, onChange, onClose, anchorRef }: ColorModalProps) {
  const [customHex, setCustomHex] = useState(value || "#6B5FE6");

  useEffect(() => {
    setCustomHex(value || "#6B5FE6");
  }, [value]);

  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 260) });
    }
  }, [anchorRef]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function handleSelectColor(hex: string) {
    setCustomHex(hex);
    onChange(hex);
  }

  if (!pos.width) return null;

  return createPortal(
    <div
      ref={ref}
      className="fixed"
      role="dialog"
      aria-modal="true"
      style={{
        top: pos.top,
        left: pos.left,
        width: Math.max(pos.width, 264),
        background: "#141414",
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
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid rgba(242,237,228,0.06)" }}
      >
        <span
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: "1rem",
            color: "#f2ede4",
            letterSpacing: "-0.01em",
          }}
        >
          Choisir une couleur
        </span>

        <button
          type="button"
          onClick={onClose}
          className="text-[#555] hover:text-[#f2ede4] transition-colors duration-150 cursor-pointer border-none bg-transparent p-0 leading-none outline-none focus:outline-none"
          aria-label="Fermer"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>

      {/* Preset Swatches Grid */}
      <div className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#888] mb-2.5">
          Couleurs prédéfinies
        </div>
        <div className="grid grid-cols-7 gap-2">
          {PRESET_COLORS.map((hex) => {
            const isSelected = value?.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => handleSelectColor(hex)}
                className="flex items-center justify-center h-7 w-7 rounded-md transition-transform duration-100 hover:scale-110 cursor-pointer border border-white/10"
                style={{ background: hex }}
                title={hex}
              >
                {isSelected && <Check size={13} className="text-white drop-shadow-md stroke-[3]" />}
              </button>
            );
          })}
        </div>

        {/* Custom Color Input Row */}
        <div className="mt-4 pt-3 border-t border-white/6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#888] mb-2">
            Couleur personnalisée
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <input
                type="color"
                value={customHex}
                onChange={(e) => handleSelectColor(e.target.value)}
                className="h-8 w-8 rounded cursor-pointer opacity-0 absolute inset-0 z-10"
              />
              <div
                className="h-8 w-8 rounded border border-white/20 shadow-inner"
                style={{ background: customHex }}
              />
            </div>
            <input
              type="text"
              value={customHex}
              onChange={(e) => {
                const val = e.target.value;
                setCustomHex(val);
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                  onChange(val);
                }
              }}
              className="flex-1 bg-[#1a1a1a] border border-white/10 rounded px-2.5 py-1.5 text-xs text-[#f2ede4] font-mono focus:border-[var(--color-beige,#D4C4A8)] outline-none"
              placeholder="#6B5FE6"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ColorModal;
