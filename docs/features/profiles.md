# Feature — profiles

Status: **built** (P1.5, P1.7). Public author profile is **planned and deferred** (P1.8).

Scope: the authenticated profile view/edit surface, the `profiles` table, and the fields a
learner or author can set. Related background: [architecture](../architecture.md),
[data model](../data-model.md), [authoring](./authoring.md), [payments](./payments.md), [discovery](./discovery.md), [player and progress](./player-progress.md), [author analytics](./analytics.md).

## What exists

| Path | Kind | Role |
|---|---|---|
| `apps/web/app/(app)/profile/page.tsx` | server component | Loads the session and the profile row, renders the form |
| `apps/web/app/(app)/profile/profile-form.tsx` | client component | react-hook-form + zod form, social-link field array |
| `apps/web/app/(app)/profile/actions.ts` | server action | `updateProfile` — validates, then upserts |
| `apps/web/app/(app)/profile/schema.ts` | zod schema | `profileSchema`, `ProfileFormValues` |
| `packages/db/src/schema/profile.ts` | Drizzle | `profiles` table, `user` FK target |

Access is gated twice. `apps/web/middleware.ts` matches `/profile/:path*` and redirects to
`/sign-in?next=/profile` when no session cookie is present. The page then re-checks the session
server-side with `auth.api.getSession` and redirects again, so a forged or stale cookie is not
enough. The cookie check is optimistic only.

## Data model

`profiles` holds presentation fields only. Identity (name, email) stays in Better Auth's `user`
table, which `packages/db` mirrors minimally as an `id`-only table so the foreign key target
exists for Drizzle.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | Primary key. App-generated UUID (`crypto.randomUUID()`). |
| `user_id` | `text` | **Unique**, not null, FK to `user.id`, `ON DELETE CASCADE`. One profile per user. |
| `bio` | `text` | Nullable. |
| `website_url` | `text` | Nullable. |
| `social_links_json` | `text` | Nullable. JSON array of `{ label, url }`. |
| `avatar_url` | `text` | Nullable. |
| `created_at` | `timestamptz` | `defaultNow()`. |
| `updated_at` | `timestamptz` | `defaultNow()`; set explicitly on every write. |

Exported aliases: `profiles` (canonical), `profile`, `userProfiles`, `userProfile`; types `Profile`
and `NewProfile`.

There is no `display_name`, `headline`, or `role` column on `profiles`. A public profile page must
read the display name from the `user` table.

## Validation

`profileSchema` in `apps/web/app/(app)/profile/schema.ts` is the single validator, shared by the
client resolver and the server action.

| Field | Rule |
|---|---|
| `bio` | string, max 1000 characters |
| `websiteUrl` | `""` or a valid URL |
| `avatarUrl` | `""` or a valid URL |
| `socialLinks` | array of `{ label: string (min 1), url: valid URL }` |

Empty string is the form's representation of "unset". The action converts `""` to `null` for
`bio`, `websiteUrl`, and `avatarUrl`, and stores `socialLinksJson` as `null` when the array is
empty.

## Write semantics

`updateProfile` in `actions.ts`:

1. Re-reads the session; throws `Error("Unauthorized")` when absent.
2. Parses the input with `profileSchema.parse` — a bad payload throws before the database is touched.
3. Maps empty strings to `null` and serializes the social links.
4. Runs `insert ... onConflictDoUpdate({ target: profiles.userId, set: values })`.

The upsert on the unique `user_id` means one request covers both first save and later edits, with
no read-before-write. `updatedAt` is set to the current time in the same statement.

The page reads defensively: `parseSocialLinks` returns `[]` for `null`, malformed JSON, or a
non-array value, so a bad row degrades to an empty list rather than a 500.

The form reports a single "Saved" or error string; there is no optimistic update and no toast
system. `page.tsx` sets `export const instant = false` and awaits `connection()`, so the route is
dynamic and never serves a cached shell.

## Gaps

- **No avatar upload.** `avatarUrl` is a pasted URL. Object storage (MinIO/S3) is configured in
  Docker Compose but no upload endpoint exists.
- **No profile test.** `apps/web/app/(app)/profile` has no unit or E2E coverage. The unit suites in
  the repo today cover `packages/db/schema/{course,event}`,
  `packages/ui/{drafts,editor,sanitize,sortable}`, `apps/web/lib/mux`, the Mux webhook route, and
  `apps/web/app/(app)/teach/courses/actions`; the only E2E spec is `apps/web/e2e/smoke.spec.ts`.
- **No length limit on `websiteUrl`, `avatarUrl`, or individual social links**, and no cap on
  `socialLinks` length. Only `bio` is bounded.
- **Initial migration landed.** `drizzle.config.ts`, `db:generate`/`db:migrate` scripts, and
  initial SQL migration in `packages/db/drizzle/` provide the `profiles` table schema.
- The same form serves learners and authors. There is no role-dependent field set; the `Role`
  union in `apps/web/lib/roles.ts` (`student | instructor | ta | admin`) is not consulted by
  anything under `profile/`.

## P1.8 — public author profile (deferred)

Not built. No route, component, or query serves a profile to anyone other than its owner. The
profile page always resolves the owner from the session; there is no `/[handle]` or `/authors/[id]`
route, and no public projection of `profiles`.

Deferred deliberately until courses exist: the page's content is the author's published courses,
and until course CRUD and publish land (P2.6, P2.7, P2.10) there is nothing to list. Building it now
would mean shipping a page that renders a bio and an empty course list.

Prerequisites before it can be built:

- A published-course query filtered by `authorId` and `status = 'published'` (see the `courses`
  table in [data-model](../data-model.md)).
- A decision on the public identifier — the `profiles` table has no handle or slug column, so the
  URL is either the internal `user.id` or a new column plus backfill.
- A display name, which must come from the `user` table, not `profiles`.
