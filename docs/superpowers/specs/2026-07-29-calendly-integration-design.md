# Calendly Integration — Design

Date: 2026-07-29
Status: Approved

## Context

Prospection email templates already paste a Calendly link as plain text. Goal: sync bookings made through that link back into the CRM's Agenda automatically, plus link them to matching Leads.

Constraint discovered during design: connected Calendly account is on the **Free plan**, which does not support webhook subscriptions. Sync uses polling (same `pg_cron` pattern as `poll-gmail-inbox`) instead of webhooks.

## Scope

- OAuth connect flow ("Connecter Calendly" button in `AgendaHeader.tsx`), mono-user (single connected account), mirrors `linkedin_accounts`/`gmail_accounts` pattern exactly.
- Polling sync of scheduled events (bookings + cancellations) into a new `calendly_bookings` table.
- Auto-match booking invitee email → existing Lead, write an auto history entry on the lead.
- Agenda UI shows bookings merged with existing manual events, sorted by date/time.

Out of scope: `{{calendly}}` merge-tag in email templates (link is already pasted as static text, not changing that), multi-user Calendly connections, reschedule-specific handling beyond cancel+recreate (Calendly's reschedule flow cancels the old event and creates a new one, which the poll naturally picks up as a cancellation + a new booking).

## Data model (Supabase)

### `calendly_accounts`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| access_token | text | |
| refresh_token | text | |
| expires_at | timestamptz | |
| calendly_user_uri | text | from `GET /users/me`, needed to scope `/scheduled_events` queries |
| connected_at | timestamptz | |

Single row (mono-user tool, same convention as `gmail_accounts`).

### `calendly_bookings`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| calendly_event_uri | text unique | Calendly's scheduled-event URI — idempotency key for upsert |
| title | text | event type name (e.g. "30 Minute Meeting") |
| start_time | timestamptz | |
| end_time | timestamptz | |
| invitee_name | text | |
| invitee_email | text | |
| location | text nullable | Zoom link / phone / address, from Calendly |
| status | text | `active` \| `canceled` |
| cancel_reason | text nullable | |
| lead_id | uuid nullable fk → leads(id) | set on email match |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## OAuth connect flow

Mirrors `linkedin-oauth-start` / `linkedin-oauth-callback` exactly.

- Edge fn `calendly-oauth-start`: builds `https://auth.calendly.com/oauth/authorize` URL with client_id/redirect_uri/state, 302-redirects browser there. Called by direct navigation, not fetch.
- Edge fn `calendly-oauth-callback`: exchanges `code` at `https://auth.calendly.com/oauth/token`, calls `GET https://api.calendly.com/users/me` for `calendly_user_uri`, upserts `calendly_accounts` (single row), triggers one immediate poll run (backfill existing bookings instead of waiting for next cron tick), redirects to Agenda with success/error state in the URL (same `redirectWithError` pattern as LinkedIn's callback).

## Polling sync

Edge fn `poll-calendly-bookings`, `requireServiceRole` (like `poll-gmail-inbox`), triggered by `pg_cron` every 5 minutes.

1. Load the single `calendly_accounts` row. If none, return `{skipped: "no account connected"}`.
2. Refresh `access_token` if `expires_at` is within 5 minutes (refresh_token grant).
3. `GET /scheduled_events?user={calendly_user_uri}&min_start_time=now-30d&max_start_time=now+90d&sort=start_time:asc&count=100`, paginate via `pagination.next_page` if present.
4. For each event, `GET /scheduled_events/{uuid}/invitees` for invitee name/email/status/cancel_reason.
5. Upsert into `calendly_bookings` keyed on `calendly_event_uri`.
6. **Only on an actual status transition** (row didn't exist before, or `active` → `canceled`): if `invitee_email` case-insensitively matches a non-archived Lead's `email`, set `lead_id` and insert an auto `history` row (`is_auto: true`, `action_type: 'calendly_booking'`, content e.g. *"Rendez-vous Calendly programmé le 4 août à 14h30"* or *"...annulé"*). Re-running the same poll twice must not duplicate history rows — compare previous `status` before updating.

Canceled bookings are kept (not deleted) with `status = 'canceled'`, shown muted with an "Annulé" badge — consistent with the audit-trail style used elsewhere (e.g. `scheduled_linkedin_posts.status`).

## UI changes

- `AgendaHeader.tsx`: "Connecter Calendly" button next to existing iCal/+Événement buttons. Shows `email (Connecté)` once linked, same visual treatment as the Gmail button in `ProspectionHeader.tsx`.
- New `src/services/calendlyService.ts`: `isConnected()`, `oauthConnectUrl()`, `listBookings()`, `disconnect()` — mirrors `linkedinService.ts` shape.
- New `src/hooks/useCalendlyBookings.ts`, merged into `Agenda.tsx`'s upcoming/past split alongside `useAgendaEvents` — both event types sort together by date/time (event's `event_date` treated as start-of-day for comparison).
- New `src/views/agenda/BookingCard.tsx` (sibling to `EventCard.tsx`): shows time (HH:mm), invitee name, "via Calendly" badge, link to matched Lead if `lead_id` set, muted + "Annulé" styling when `status = 'canceled'`.

## Error handling

- OAuth denied/error at Calendly → redirect to Agenda with error toast (mirrors `linkedin-oauth-callback`'s `redirectWithError`).
- Token refresh failure during poll → log, skip that cycle, retry next tick (background job, no user-facing action).
- No account connected → poll fn returns early, no-op.
- Free-plan API rate limits → not expected to be hit at this booking volume; no special handling.

## Testing

- Unit tests for `calendlyService.ts` (client-side): booking status/date formatting, merge-and-sort logic with `useAgendaEvents`.
- Edge functions tested manually against a real Calendly OAuth connect + real test bookings (Calendly's side can't be meaningfully mocked, same precedent as LinkedIn).

## Risks / open dependencies

- Polling means up to ~5 min delay before a new booking or cancellation shows up (vs instant with webhooks) — acceptable given free-plan constraint.
- If the Calendly account is later upgraded to a paid plan, this could be swapped to webhooks (real-time) as a follow-up — out of scope for this spec.
