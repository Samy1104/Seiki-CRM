import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Format a date string (YYYY-MM-DD) to iCal DATE format (YYYYMMDD)
function toIcalDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

// Escape special characters for iCal text fields
function escapeIcal(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Fold long iCal lines at 75 octets (RFC 5545 §3.1)
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

serve(async (_req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
  };

  if (_req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch all events
    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) throw error;

    // Build iCal content
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SEIKI CRM//Agenda//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:SEIKI CRM – Agenda",
      "X-WR-CALDESC:Événements de prospection et salons professionnels SEIKI",
      "X-WR-TIMEZONE:Europe/Paris",
    ];

    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    for (const event of events ?? []) {
      const uid = event.ical_uid || `${event.id}@seiki-crm`;
      const dtstart = toIcalDate(event.event_date);
      
      // End date: if provided use it + 1 day (iCal end is exclusive); otherwise same day + 1
      let dtend: string;
      if (event.end_date) {
        const endDate = new Date(event.end_date);
        endDate.setDate(endDate.getDate() + 1);
        dtend = endDate.toISOString().slice(0, 10).replace(/-/g, "");
      } else {
        const startDate = new Date(event.event_date);
        startDate.setDate(startDate.getDate() + 1);
        dtend = startDate.toISOString().slice(0, 10).replace(/-/g, "");
      }

      const summary = escapeIcal(event.name);
      const location = event.location ? escapeIcal(event.location) : null;

      let description = "";
      if (event.objective) description += `Objectif : ${event.objective}`;
      if (event.segment) {
        if (description) description += "\\n";
        description += `Segment : ${event.segment}`;
      }
      const descEscaped = description ? escapeIcal(description) : null;

      lines.push("BEGIN:VEVENT");
      lines.push(foldLine(`UID:${uid}`));
      lines.push(foldLine(`DTSTAMP:${now}`));
      lines.push(foldLine(`DTSTART;VALUE=DATE:${dtstart}`));
      lines.push(foldLine(`DTEND;VALUE=DATE:${dtend}`));
      lines.push(foldLine(`SUMMARY:${summary}`));
      if (location) lines.push(foldLine(`LOCATION:${location}`));
      if (descEscaped) lines.push(foldLine(`DESCRIPTION:${descEscaped}`));
      lines.push(foldLine(`CREATED:${now}`));
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const icalContent = lines.join("\r\n");

    return new Response(icalContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="seiki-agenda.ics"',
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (err) {
    console.error("Error generating iCal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
