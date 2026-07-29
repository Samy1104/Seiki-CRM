// ============================================================
// _shared/calendlyApi.ts
// Helpers API REST Calendly (échange/refresh OAuth, liste des
// événements planifiés, invités) partagés par calendly-oauth-callback
// et poll-calendly-bookings.
// ============================================================

import { fetchWithTimeout } from "./fetchWithTimeout.ts";

export function buildRedirectUri(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/calendly-oauth-callback`;
}

export interface CalendlyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function requestToken(params: Record<string, string>): Promise<CalendlyTokenResponse> {
  const clientId = Deno.env.get("CALENDLY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("CALENDLY_CLIENT_SECRET")!;
  const body = new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret });

  const res = await fetchWithTimeout("https://auth.calendly.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Calendly OAuth error: ${JSON.stringify(data)}`);
  return data as CalendlyTokenResponse;
}

export function exchangeCodeForToken(code: string, redirectUri: string): Promise<CalendlyTokenResponse> {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(refreshToken: string): Promise<CalendlyTokenResponse> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function fetchCurrentUserUri(accessToken: string): Promise<string> {
  const res = await fetchWithTimeout("https://api.calendly.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Calendly users/me error: ${JSON.stringify(data)}`);
  return data.resource.uri as string;
}

export interface CalendlyLocation {
  type: string;
  location?: string;
  join_url?: string;
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  location: CalendlyLocation | null;
}

export async function listScheduledEvents(
  accessToken: string,
  userUri: string,
  minStartTime: string,
  maxStartTime: string,
): Promise<CalendlyScheduledEvent[]> {
  const events: CalendlyScheduledEvent[] = [];
  let url: string | null =
    `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}` +
    `&min_start_time=${encodeURIComponent(minStartTime)}&max_start_time=${encodeURIComponent(maxStartTime)}` +
    `&sort=start_time:asc&count=100`;

  while (url) {
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Calendly scheduled_events error: ${JSON.stringify(data)}`);
    events.push(...(data.collection as CalendlyScheduledEvent[]));
    url = data.pagination?.next_page ?? null;
  }

  return events;
}

export interface CalendlyInvitee {
  name: string;
  email: string;
  status: "active" | "canceled";
  cancel_reason: string | null;
}

export async function listEventInvitees(accessToken: string, eventUri: string): Promise<CalendlyInvitee[]> {
  const res = await fetchWithTimeout(`${eventUri}/invitees`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Calendly invitees error: ${JSON.stringify(data)}`);
  return (data.collection as Array<{ name: string; email: string; status: "active" | "canceled"; cancellation?: { reason: string | null } }>).map(
    (inv) => ({
      name: inv.name,
      email: inv.email,
      status: inv.status,
      cancel_reason: inv.cancellation?.reason ?? null,
    }),
  );
}

// Un événement en présentiel n'a qu'un `location`, un événement en visio n'a
// qu'un `join_url` — jamais les deux. On priorise join_url (le cas le plus
// courant pour ce compte) puis retombe sur location.
export function formatLocation(location: CalendlyLocation | null): string | null {
  if (!location) return null;
  if (location.join_url) return location.join_url;
  if (location.location) return location.location;
  return null;
}
