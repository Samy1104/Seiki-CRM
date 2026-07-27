// ============================================================
// _shared/gmailApi.ts
// Helpers Gmail REST API (OAuth token exchange/refresh, envoi,
// lecture de message, polling d'historique) partagés par
// gmail-oauth-callback, dispatch-gmail-sends et poll-gmail-inbox.
// Pas de test unitaire ici (usage Deno.env) — même convention que
// _shared/linkedinApi.ts.
// ============================================================

import { fetchWithTimeout } from "./fetchWithTimeout.ts";
import type { GmailMessage } from "./gmailMessageParser.ts";

export function buildRedirectUri(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/gmail-oauth-callback`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;
  const body = new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret });

  const res = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail OAuth error: ${JSON.stringify(data)}`);
  return data as TokenResponse;
}

export function exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function fetchGmailAddress(accessToken: string): Promise<string> {
  const res = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail profile error: ${JSON.stringify(data)}`);
  return data.emailAddress as string;
}

export async function getCurrentHistoryId(accessToken: string): Promise<string> {
  const res = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail profile error: ${JSON.stringify(data)}`);
  return String(data.historyId);
}

export async function sendRawMessage(accessToken: string, rawBase64Url: string): Promise<{ id: string; threadId: string }> {
  const res = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: rawBase64Url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail send error: ${JSON.stringify(data)}`);
  return { id: data.id, threadId: data.threadId };
}

export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const res = await fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail get message error: ${JSON.stringify(data)}`);
  return data as GmailMessage;
}

/**
 * Renvoie les IDs des messages ajoutés à l'INBOX depuis startHistoryId.
 * Lève une erreur si startHistoryId est trop ancien (Gmail purge son
 * historique) — l'appelant (poll-gmail-inbox) doit alors resynchroniser
 * via getCurrentHistoryId().
 */
export async function listHistory(accessToken: string, startHistoryId: string): Promise<{ historyId: string; addedMessageIds: string[] }> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
  url.searchParams.set("startHistoryId", startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("labelId", "INBOX");

  const res = await fetchWithTimeout(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail history error ${res.status}: ${JSON.stringify(data)}`);

  const addedMessageIds: string[] = [];
  for (const h of data.history ?? []) {
    for (const m of h.messagesAdded ?? []) {
      addedMessageIds.push(m.message.id);
    }
  }
  return { historyId: data.historyId ?? startHistoryId, addedMessageIds };
}
