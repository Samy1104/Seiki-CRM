// ============================================================
// _shared/linkedinApi.ts
// (fetchWithTimeout import below caps every outbound call so a slow/hung
// LinkedIn API response can't stall the calling function indefinitely.)
// Helpers LinkedIn REST API (OAuth token exchange/refresh, upload
// image, publication de post) partagés par linkedin-oauth-callback
// et publish-linkedin-post.
// ============================================================

// Format YYYYMM (ex: "202607" pour juillet 2026). LinkedIn désactive les
// versions de plus de ~12 mois — si les publications se remettent à échouer
// avec NONEXISTENT_VERSION, bump ce défaut ou le secret LINKEDIN_API_VERSION.
import { fetchWithTimeout } from "./fetchWithTimeout.ts";

const LINKEDIN_API_VERSION = Deno.env.get("LINKEDIN_API_VERSION") || "202607";

// Doit être identique à l'URI enregistrée dans l'app LinkedIn Developer et
// utilisée à la fois par linkedin-oauth-start (autorisation) et
// linkedin-oauth-callback (échange du code) — un seul endroit pour éviter
// que les deux dérivent si la fonction est un jour renommée.
export function buildRedirectUri(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/linkedin-oauth-callback`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
  const body = new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret });

  const res = await fetchWithTimeout("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn OAuth error: ${JSON.stringify(data)}`);
  return data as TokenResponse;
}

export function exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function fetchMemberUrn(accessToken: string): Promise<string> {
  const res = await fetchWithTimeout("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn userinfo error: ${JSON.stringify(data)}`);
  return `urn:li:person:${data.sub}`;
}

// Renvoie l'URN de la première organisation où le compte est admin.
// Nécessite le scope w_organization_social + accès Community Management API.
export async function fetchAdminOrgUrn(accessToken: string): Promise<string> {
  const res = await fetchWithTimeout(
    "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": LINKEDIN_API_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn organizationAcls error: ${JSON.stringify(data)}`);
  const first = data.elements?.[0];
  if (!first) throw new Error("Aucune organisation LinkedIn administrée trouvée pour ce compte");
  return first.organization as string;
}

export async function uploadImage(accessToken: string, authorUrn: string, imageBytes: Uint8Array): Promise<string> {
  const initRes = await fetchWithTimeout("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  const initData = await initRes.json();
  if (!initRes.ok) throw new Error(`LinkedIn image init error: ${JSON.stringify(initData)}`);

  const uploadUrl = initData.value.uploadUrl as string;
  const imageUrn = initData.value.image as string;

  const putRes = await fetchWithTimeout(uploadUrl, { method: "PUT", body: imageBytes }, 30000);
  if (!putRes.ok) throw new Error(`LinkedIn image upload failed: HTTP ${putRes.status}`);

  return imageUrn;
}

export async function publishPost(
  accessToken: string,
  authorUrn: string,
  text: string,
  imageUrn?: string,
): Promise<string> {
  const payload: Record<string, unknown> = {
    author: authorUrn,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (imageUrn) {
    payload.content = { media: { id: imageUrn } };
  }

  const res = await fetchWithTimeout("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`LinkedIn publish failed HTTP ${res.status}: ${errBody}`);
  }

  return res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "unknown";
}
