# LinkedIn Post Scheduler — Design

Date: 2026-07-15
Status: Approved

## Context

`Contenu.tsx` currently only generates a LinkedIn post draft (via `generate-linkedin-post` edge fn) and lets the user copy it manually. Goal: let the user schedule a generated (or edited) post for a specific date/time and have it auto-publish to LinkedIn, no manual copy-paste needed.

Reuses the queue + `pg_cron` pattern already proven by `flush-send-queue` (email prospection).

## Scope

- Auto-publish to real LinkedIn accounts via LinkedIn API (not a reminder-only queue).
- Two publish targets, chosen per post: personal profile (Jaafar) and company Page (Seiki).
- Text + optional single image per post.
- Simple list UI (not calendar) for the scheduled-post queue.

## Data model (Supabase)

### `linkedin_accounts`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| target_type | text | `personal` \| `company` |
| label | text | "Jaafar" / "Seiki" |
| access_token | text (encrypted at rest via Supabase Vault or pgsodium) | |
| refresh_token | text nullable | not all LinkedIn token grants include one |
| expires_at | timestamptz | |
| linkedin_urn | text | author URN required by UGC Posts API |
| connected_by | text | |
| connected_at | timestamptz | |

### `scheduled_linkedin_posts`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| hook | text | |
| corps | text | |
| hashtags | text[] | |
| image_path | text nullable | Supabase Storage path, bucket `linkedin-media` |
| target_account_id | uuid fk → linkedin_accounts | |
| scheduled_at | timestamptz | |
| status | text | `scheduled` \| `posted` \| `failed` |
| error_message | text nullable | |
| linkedin_post_urn | text nullable | set on success |
| created_at | timestamptz | |

## OAuth connect flow

- Edge fn `linkedin-oauth-start`: builds LinkedIn authorize URL.
  - Personal: scopes `openid profile w_member_social` — self-serve via "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn" products, no LinkedIn review needed.
  - Company: scope `w_organization_social` — requires LinkedIn Community Management API access approval (external dependency, timeline outside our control; posts to Seiki Page are blocked until this is granted).
- Edge fn `linkedin-oauth-callback`: exchanges auth code for access/refresh token, upserts `linkedin_accounts` row.
- UI: "Connecter LinkedIn" button per target in `Contenu.tsx`, shows connected/expired state.

## Publish flow

- Edge fn `publish-linkedin-post`, triggered by `pg_cron` every 5 minutes (`*/5 * * * *`).
- Query `scheduled_linkedin_posts` where `status = 'scheduled' AND scheduled_at <= now()`.
- Per row:
  1. If `image_path` set: register upload with LinkedIn, PUT binary from Storage, get asset URN.
  2. Refresh access token if near `expires_at` and a refresh token exists.
  3. Call LinkedIn UGC Posts API with author URN, text (hook + corps + hashtags), optional image asset.
  4. Success → `status = 'posted'`, store `linkedin_post_urn`.
  5. Failure → `status = 'failed'`, store `error_message`. No automatic retry.

## UI changes (`Contenu.tsx`)

- Post preview area becomes editable (`hook`/`corps` textareas instead of read-only div).
- Add: target selector (Jaafar / Seiki), datetime picker, "Programmer" button next to existing "Copier".
- Optional image file input → uploads to `linkedin-media` bucket, stores path.
- New "Posts programmés" section: list sorted by `scheduled_at`, each row shows preview snippet, target, date/time, status badge.
  - `scheduled` → Edit / Cancel.
  - `failed` → shows truncated `error_message`, Retry button (resets status to `scheduled`, same `scheduled_at` or now).
  - `posted` → link to the LinkedIn post if available.

## Error handling

- Expired/missing token at publish time → `status = 'failed'`, `error_message = "Compte LinkedIn déconnecté"`; UI shows a reconnect banner for that target.
- LinkedIn API errors (rate limit, content rejected, etc.) → `status = 'failed'`, raw error message truncated for display.

## Testing

- Unit tests for `linkedinService.ts` (client-side): status/date formatting logic.
- Edge functions tested manually against local Supabase + real LinkedIn OAuth redirect (LinkedIn's side can't be mocked meaningfully).

## Risks / open dependencies

- Company Page publishing needs LinkedIn Community Management API approval — unknown lead time, may block that half of scope. Personal-profile publishing has no such blocker.
- Token refresh depends on LinkedIn's grant including a refresh token; if not, user must manually reconnect when the access token expires (~60 days).
