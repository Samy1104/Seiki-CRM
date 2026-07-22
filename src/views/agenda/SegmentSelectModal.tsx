import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

interface SegmentSelectModalProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export const SegmentSelectModal: React.FC<SegmentSelectModalProps> = ({
  options,
  value,
  onChange,
  onClose,
  anchorRef,
}) => {
  const initialIndex = Math.max(0, options.indexOf(value));
  const [highlightedIndex, setHighlightedIndex] = useState<number>(initialIndex);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 220) });
    }
  }, [anchorRef]);

  // Handle outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, anchorRef]);

  // Handle keyboard navigation (Arrow Up, Arrow Down, Enter, Escape)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedOption = options[highlightedIndex];
        if (selectedOption) {
          onChange(selectedOption);
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [highlightedIndex, options, onChange, onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    const item = itemRefs.current[highlightedIndex];
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  return createPortal(
    <div
      ref={ref}
      className="fixed py-2 overflow-hidden max-h-[300px] overflow-y-auto outline-none focus:outline-none focus-visible:outline-none"
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        background: "#111",
        borderTop: "1px solid var(--color-beige, #D4C4A8)",
        borderLeft: "1px solid rgba(242,237,228,0.08)",
        borderRight: "1px solid rgba(242,237,228,0.08)",
        borderBottom: "1px solid rgba(242,237,228,0.08)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
        zIndex: 9999,
        fontFamily: "'Inter', sans-serif",
        userSelect: "none",
        outline: "none",
      }}
    >
      {options.map((option, index) => {
        const isSelected = value === option;
        const isHighlighted = highlightedIndex === index;
        return (
          <button
            key={option}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            onClick={() => {
              onChange(option);
              onClose();
            }}
            onMouseEnter={() => setHighlightedIndex(index)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors duration-150 cursor-pointer text-left outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            style={{
              color: isSelected || isHighlighted ? "var(--color-beige, #D4C4A8)" : "#b0afa8",
              background: isHighlighted
                ? "rgba(212,196,168,0.12)"
                : isSelected
                ? "rgba(212,196,168,0.06)"
                : "transparent",
              fontWeight: isSelected ? 600 : 400,
              outline: "none",
            }}
          >
            <span>{option}</span>
            {isSelected && (
              <Check size={13} strokeWidth={2} style={{ color: "var(--color-beige, #D4C4A8)" }} />
            )}
          </button>
        );
      })}
    </div>,
    document.body
  );
};
