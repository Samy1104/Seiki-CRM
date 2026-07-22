import React, { useState, useRef, useEffect } from "react";
import { Plus, ChevronUp, Calendar } from "lucide-react";
import CalendarModal from "../../components/CalendarModal";
import type { EventItem } from "../../services/eventsService";

export const SEGMENTS = [
  "Tous les segments",
  "Général",
  "Média",
  "Investisseurs",
  "Partenaires",
];

interface AgendaFormProps {
  formOpen: boolean;
  setFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingEvent: EventItem | null;
  onSaveEvent: (eventData: {
    name: string;
    event_date: string;
    end_date: string | null;
    location: string | null;
    segment: string | null;
    objective: string | null;
  }) => Promise<void>;
  onCancelEdit: () => void;
}

export const AgendaForm: React.FC<AgendaFormProps> = ({
  formOpen,
  setFormOpen,
  editingEvent,
  onSaveEvent,
  onCancelEdit,
}) => {
  const [form, setForm] = useState({
    name: "",
    location: "",
    startDate: "",
    endDate: "",
    segment: "Tous les segments",
    objective: "",
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [openCal, setOpenCal] = useState<"startDate" | "endDate" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startDateRef = useRef<HTMLButtonElement>(null);
  const endDateRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Sync form when editingEvent changes
  useEffect(() => {
    if (editingEvent) {
      setForm({
        name: editingEvent.name || "",
        location: editingEvent.location || "",
        startDate: editingEvent.event_date || "",
        endDate: editingEvent.end_date || "",
        segment: editingEvent.segment || "Tous les segments",
        objective: editingEvent.objective || "",
      });
      setFormOpen(true);
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [editingEvent, setFormOpen]);

  function resetForm() {
    setForm({
      name: "",
      location: "",
      startDate: "",
      endDate: "",
      segment: "Tous les segments",
      objective: "",
    });
  }

  function inputStyle(field: string) {
    return {
      borderBottom: `1px solid ${
        focusedField === field ? "var(--color-beige, #D4C4A8)" : "rgba(242,237,228,0.12)"
      }`,
      transition: "border-color 0.2s ease",
      outline: "none",
      boxShadow: "none",
    };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate) return;

    setIsSubmitting(true);
    try {
      await onSaveEvent({
        name: form.name.trim(),
        event_date: form.startDate,
        end_date: form.endDate || null,
        location: form.location.trim() || null,
        segment: form.segment || null,
        objective: form.objective.trim() || null,
      });
      resetForm();
      if (!editingEvent) {
        setFormOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={formRef}
      className="mb-10"
      style={{
        borderTop: "1px solid rgba(242,237,228,0.08)",
        borderBottom: formOpen ? "none" : "1px solid rgba(242,237,228,0.08)",
      }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between py-4 transition-colors duration-150 group cursor-pointer"
        onClick={() => {
          if (formOpen && editingEvent) {
            onCancelEdit();
            resetForm();
          }
          setFormOpen((v) => !v);
        }}
      >
        <div className="flex items-center gap-2.5">
          <Plus
            size={14}
            strokeWidth={1.5}
            style={{ color: "var(--color-beige, #D4C4A8)" }}
          />
          <span
            className="text-[12px] tracking-[0.2em] uppercase font-medium"
            style={{ color: "var(--color-charcoal-fg-soft, #b0afa8)" }}
          >
            {editingEvent ? "Modifier l'événement" : "Ajouter un événement"}
          </span>
        </div>
        <ChevronUp
          size={14}
          strokeWidth={1.5}
          style={{
            color: "#555",
            transform: formOpen ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 0.25s ease",
          }}
        />
      </button>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="pb-8"
          style={{ borderBottom: "1px solid rgba(242,237,228,0.08)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-7">
            {/* Nom */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#555" }}>
                Nom de l'événement <span style={{ color: "var(--color-beige, #D4C4A8)" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="ex : MIPIM Cannes"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
                className="bg-transparent outline-none focus:outline-none focus:ring-0 text-[13px] py-2 px-0 w-full"
                style={{
                  color: "var(--color-charcoal-fg, #f2ede4)",
                  caretColor: "var(--color-beige, #D4C4A8)",
                  ...inputStyle("name"),
                }}
              />
            </div>

            {/* Lieu */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#555" }}>
                Lieu
              </label>
              <input
                type="text"
                placeholder="ex : Cannes, France"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                onFocus={() => setFocusedField("location")}
                onBlur={() => setFocusedField(null)}
                className="bg-transparent outline-none focus:outline-none focus:ring-0 text-[13px] py-2 px-0 w-full"
                style={{
                  color: "var(--color-charcoal-fg, #f2ede4)",
                  caretColor: "var(--color-beige, #D4C4A8)",
                  ...inputStyle("location"),
                }}
              />
            </div>

            {/* Date début */}
            <div className="flex flex-col gap-2 relative">
              <label className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#555" }}>
                Date de début <span style={{ color: "var(--color-beige, #D4C4A8)" }}>*</span>
              </label>
              <button
                ref={startDateRef}
                type="button"
                onClick={() => setOpenCal(openCal === "startDate" ? null : "startDate")}
                className="flex items-center justify-between py-2 px-0 w-full text-left transition-colors duration-200 cursor-pointer"
                style={{
                  borderBottom: `1px solid ${
                    openCal === "startDate" ? "var(--color-beige, #D4C4A8)" : "rgba(242,237,228,0.12)"
                  }`,
                  color: form.startDate ? "var(--color-charcoal-fg, #f2ede4)" : "#444",
                }}
              >
                <span className="text-[13px]">
                  {form.startDate
                    ? new Date(form.startDate + "T12:00:00").toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "jj/mm/aaaa"}
                </span>
                <Calendar size={13} strokeWidth={1.5} style={{ color: "#555" }} />
              </button>
              {openCal === "startDate" && (
                <CalendarModal
                  value={form.startDate}
                  onChange={(v) => setForm({ ...form, startDate: v })}
                  onClose={() => setOpenCal(null)}
                  anchorRef={startDateRef}
                />
              )}
            </div>

            {/* Date fin */}
            <div className="flex flex-col gap-2 relative">
              <label className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#555" }}>
                Date de fin
              </label>
              <button
                ref={endDateRef}
                type="button"
                onClick={() => setOpenCal(openCal === "endDate" ? null : "endDate")}
                className="flex items-center justify-between py-2 px-0 w-full text-left transition-colors duration-200 cursor-pointer"
                style={{
                  borderBottom: `1px solid ${
                    openCal === "endDate" ? "var(--color-beige, #D4C4A8)" : "rgba(242,237,228,0.12)"
                  }`,
                  color: form.endDate ? "var(--color-charcoal-fg, #f2ede4)" : "#444",
                }}
              >
                <span className="text-[13px]">
                  {form.endDate
                    ? new Date(form.endDate + "T12:00:00").toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "jj/mm/aaaa"}
                </span>
                <Calendar size={13} strokeWidth={1.5} style={{ color: "#555" }} />
              </button>
              {openCal === "endDate" && (
                <CalendarModal
                  value={form.endDate}
                  onChange={(v) => setForm({ ...form, endDate: v })}
                  onClose={() => setOpenCal(null)}
                  anchorRef={endDateRef}
                  minDate={form.startDate || undefined}
                />
              )}
            </div>

            {/* Segment */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#555" }}>
                Segment ciblé
              </label>
              <select
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                onFocus={() => setFocusedField("segment")}
                onBlur={() => setFocusedField(null)}
                className="bg-transparent outline-none focus:outline-none focus:ring-0 text-[13px] py-2 px-0 w-full appearance-none cursor-pointer"
                style={{
                  color: "var(--color-charcoal-fg, #f2ede4)",
                  colorScheme: "dark",
                  ...inputStyle("segment"),
                }}
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s} style={{ background: "#1a1a1a", color: "#f2ede4" }}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Objectif — full width */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "#555" }}>
                Objectif / Action clé
              </label>
              <input
                type="text"
                placeholder="ex : Rencontre 5 prospects et qualification"
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
                onFocus={() => setFocusedField("objective")}
                onBlur={() => setFocusedField(null)}
                className="bg-transparent outline-none focus:outline-none focus:ring-0 text-[13px] py-2 px-0 w-full"
                style={{
                  color: "var(--color-charcoal-fg, #f2ede4)",
                  caretColor: "var(--color-beige, #D4C4A8)",
                  ...inputStyle("objective"),
                }}
              />
            </div>
          </div>

          {/* Submit / Cancel Actions */}
          <div className="flex justify-end items-center gap-4 mt-8">
            {editingEvent && (
              <button
                type="button"
                onClick={() => {
                  onCancelEdit();
                  resetForm();
                }}
                className="px-4 py-2.5 text-[12px] tracking-[0.15em] uppercase transition-colors duration-150 cursor-pointer"
                style={{ color: "var(--color-charcoal-fg-soft, #b0afa8)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-charcoal-fg, #f2ede4)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--color-charcoal-fg-soft, #b0afa8)")}
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !form.name.trim() || !form.startDate}
              className="flex items-center gap-2 px-5 py-2.5 text-[12px] tracking-[0.15em] uppercase transition-all duration-150 cursor-pointer"
              style={{
                background: "var(--color-beige, #D4C4A8)",
                color: "var(--color-charcoal, #0d0d0d)",
                fontWeight: 600,
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "#e6d5b8")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "var(--color-beige, #D4C4A8)")
              }
            >
              <Plus size={13} strokeWidth={2} />
              {editingEvent ? "Enregistrer les modifications" : "Créer l'événement"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
