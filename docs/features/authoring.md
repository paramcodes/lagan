# Feature — course authoring

Status: the pipeline is **partly built**. The schema, the editor, the draft store, the video
plumbing, the `@dnd-kit` wrappers, and course CRUD server actions are merged. Everything that turns
a draft into published rows — the builder UI, autosave wiring, module/lesson CRUD, and a draft-based
publish — is **planned and absent**.

Cross-links: [architecture](../architecture.md), [data model](../data-model.md),
[profiles](./profiles.md), [payments](./payments.md), [discovery](./discovery.md).

## Status by item

| Item | What | State | Evidence |
|---|---|---|---|
| P2.1 | Course / module / lesson schema | **merged** | `packages/db/src/schema/course.ts`, commit `b172f24` (#6) |
| P2.2 | TipTap editor + sanitizer | **merged** | `packages/ui/src/editor.tsx`, `packages/ui/src/sanitize.ts`, `224b33a` (#9) |
| P2.3 | Mux upload + webhook | **merged** | `apps/web/lib/mux.ts`, `apps/web/app/api/mux/webhook/route.ts`, `7bca697` (#8) |
| P2.4 | IndexedDB draft store | **merged** | `packages/ui/src/drafts.ts`, `634c78f` (#7) |
| P2.5 | `@dnd-kit` wrappers | **merged** | `packages/ui/src/sortable.tsx`, `dfef1dd` (#48) |
| P2.6 | Course CRUD server actions | **merged** | `apps/web/app/(app)/teach/courses/actions.ts`, `c98bd32` (#50) |
| P2.7 | Module / lesson CRUD + ordering actions | planned | tracked as #13 |
| P2.8 | Course builder UI (cards / list toggle) | planned | tracked as #14 |
| P2.9 | Draft autosave | planned | — |
| P2.10 | Publish + version bump | planned | — |

Note on the tracker: `todos.md` now marks `P2.2` checked, but still shows `P2.5` and `P2.6`
unchecked although both are merged on `origin/master`. The tracker lags the code.

No page under `apps/web/app` renders an authoring surface. `apps/web/app/(app)/teach/courses/`
exists with server actions and their zod schemas (P2.6), but no `page.tsx` or component. The
middleware matches `/teach/:path*` and protects it, and a comment reserves a server-side role check
there. Draft manipulation is available only as an API — no component calls `useDraftStore`.

## Schema — `packages/db/src/schema/course.ts`

`tenant_id` is present on `courses` from the first migration per ADR-0002, ahead of the tenancy
ADR (ADR-0014). Status columns are `text` with a TypeScript union via `$type<...>()`, not Postgres
enums, because `erasableSyntaxOnly` forbids TS enums. Adding a member needs no type migration.

### `courses`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | Primary key. |
| `tenant_id` | `text` | Not null. Indexed. |
| `author_id` | `text` | FK to `user.id`, `ON DELETE CASCADE`. Indexed. |
| `title` | `text` | Not null. |
| `description` | `text` | Nullable. |
| `price_cents` | `integer` | Not null, default `0`. |
| `discount_percent` | `integer` | Not null, default `0`. |
| `is_free` | `boolean` | Not null, default `false`. |
| `status` | `text` | `"draft" \| "published" \| "archived"`, default `"draft"`. Indexed. |
| `version` | `integer` | Not null, default `1`. |
| `published_at` | `timestamptz` | Nullable. Null until first publish. |
| `created_at` / `updated_at` | `timestamptz` | Not null, `defaultNow()`. |

### `modules`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | Primary key. |
| `course_id` | `text` | FK to `courses.id`, cascade. Indexed. |
| `title` | `text` | Not null. |
| `position` | `integer` | Not null, default `0`. |

Unique on `(course_id, position)` — two modules in one course cannot share a slot, so a reorder must
rewrite positions in a single transaction or reorder through a temporary offset.

### `lessons`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | Primary key. |
| `module_id` | `text` | FK to `modules.id`, cascade. Indexed. |
| `type` | `text` | `"video" \| "text" \| "quiz" \| "file" \| "external"`. Not null. |
| `title` | `text` | Not null. |
| `position` | `integer` | Not null, default `0`. Unique with `module_id`. |
| `status` | `text` | `"draft" \| "published"`, default `"draft"`. |
| `mux_playback_id` | `text` | Nullable. Written by the Mux webhook. |
| `content_json` | `jsonb` | `LessonContent` = `{ type: "doc", content?: unknown[] }`. Nullable. |
| `external_url` | `text` | Nullable. For `external` lessons. |
| `file_key` | `text` | Nullable. Object-storage key for `file` lessons. |
| `updated_at` | `timestamptz` | Not null, `defaultNow()`. No `created_at`. |

Also exported: singular aliases `course`, `module`, `lesson`, and the insert types `NewCourse`,
`NewModule`, `NewLesson`.

The comment in `drafts.ts` calls these "the `course_status` union in the database schema". The
implementation is a `text` column with a TS union, not a Postgres enum. Behavior is unchanged; only
the wording differs.

## Draft store — `packages/ui/src/drafts.ts`

A local-first zustand store persisted to IndexedDB. It is deliberately separate from the server:
the shape mirrors the course/module/lesson columns and the publish step is what maps one onto the
other. Nothing in the store talks to an HTTP endpoint.

| Constant | Value |
|---|---|
| `DRAFT_DB_NAME` | `lagan-authoring` |
| `DRAFT_STORE_NAME` | `course-drafts` |
| `DRAFT_PERSIST_KEY` | `lagan:course-drafts` |
| `DRAFT_STORE_VERSION` | `1` |

Storage is `idb-keyval` over `createJSONStorage`. `createDraftStorage` falls back to
`createMemoryStorage` when `indexedDB` is undefined, which covers the server, private-mode
browsers, and tests. Only `drafts` and `activeDraftId` are persisted (`partialize`); `hydrated` is
not, and `onRehydrateStorage` sets it afterwards or logs `[lagan/ui] could not rehydrate course
drafts` on error. Gate any first render on `hydrated` to avoid flashing an empty list.

Draft ids are app-generated and prefixed: `course_<uuid>`, `module_<uuid>`, `lesson_<uuid>`, with a
`Math.random()` fallback when `crypto.randomUUID` is missing. They are not the database ids; publish
decides whether to reuse them.

### Draft types

| Type | Fields |
|---|---|
| `CourseDraft` | `id`, `title`, `description`, `priceCents`, `discountPercent`, `isFree`, `status`, `version`, `modules[]`, `createdAt`, `updatedAt` (ISO strings) |
| `ModuleDraft` | `id`, `title`, `lessons[]` |
| `LessonDraft` | `id`, `type`, `title`, `contentJson`, `muxPlaybackId`, `externalUrl`, `fileKey`, `updatedAt` |

`CourseDraftStatus` mirrors `CourseStatus`; `LessonDraftType` mirrors `LessonType`. `CourseDraft`
does not carry `tenantId`, `authorId`, or `publishedAt`; `ModuleDraft` and `LessonDraft` have no
`position` field at all.

### Actions

The store is created by `createDraftStore(options)` — `options.name` overrides the persist key and
`options.storage` overrides the backing storage. `useDraftStore` is the app-wide instance, created
at module load.

| Method | Effect |
|---|---|
| `createDraft(input?)` | New draft from `emptyCourseDraftFields`, becomes active, returns its id |
| `updateDraft(id, patch)` | Merge course-level fields, bump `updatedAt` |
| `duplicateDraft(id)` | Deep copy with fresh module and lesson ids, becomes active |
| `removeDraft(id)` | Delete; clears `activeDraftId` when it pointed at this draft |
| `setActiveDraft(id \| null)` | Ignores an unknown id |
| `clearDrafts()` | Empty the store |
| `addModule` / `updateModule` / `removeModule` | Module-level edits, `updatedAt` on the draft |
| `moveModule(draftId, moduleId, toIndex)` | Reorder; index is clamped to bounds |
| `addLesson` / `updateLesson` / `removeLesson` | Lesson edits; `updateLesson` also stamps the lesson's `updatedAt` |
| `moveLesson(draftId, moduleId, lessonId, toIndex)` | Reorder inside one module |
| `moveLessonToModule(draftId, lessonId, toModuleId, toIndex?)` | Cross-module move; delegates to `moveLesson` when source and target match |

Every course, module, and lesson edit routes through `replaceDraft`, which refreshes the draft's
`updatedAt`; the draft-list and active-pointer methods do not. A missing draft or module is a no-op,
not a throw. `moveItem` and `insertAt` clamp out-of-range indices, so a drop past the end of a list
is safe.

Selectors: `selectDraft(id)`, `selectActiveDraft`, and `selectDraftList` (most recently edited
first, by `updatedAt` string compare).

```tsx
"use client";

import { useDraftStore, selectActiveDraft } from "@lagan/ui";

export function DraftTitle() {
  const draft = useDraftStore(selectActiveDraft);
  const updateDraft = useDraftStore((state) => state.updateDraft);

  if (!draft) return null;

  return (
    <input
      value={draft.title}
      onChange={(event) => updateDraft(draft.id, { title: event.target.value })}
    />
  );
}
```

For tests, inject memory storage:

```ts
import { createDraftStore, createMemoryStorage } from "@lagan/ui";

const store = createDraftStore({ storage: createMemoryStorage(), name: "test-drafts" });
const id = store.getState().createDraft({ title: "Intro" });
```

## Editor — `packages/ui/src/editor.tsx`

`RichTextEditor` wraps TipTap with a single `StarterKit` extension array, hoisted to module scope
because TipTap treats a new array as a new configuration. It is a client component.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `string` | — | Initial HTML. Later changes call `setContent(value, { emitUpdate: false })` when it differs from `editor.getHTML()`. |
| `onChange` | `(html: string) => void` | — | Fires on every document update with `getHTML()`. Held in a ref. |
| `onReady` | `(editor: Editor) => void` | — | Once, with the instance, for commands or `getJSON()`. |
| `editable` | `boolean` | `true` | Applied via `setEditable`. |
| `placeholder` | `string` | — | Rendered only when editable and empty; `aria-hidden`. |
| `showToolbar` | `boolean` | `true` | |
| `className` | `string` | — | Merged onto the root. |
| `ariaLabel` | `string` | `"Rich text"` | Set on creation and re-applied to the DOM node. |

The editor sets `immediatelyRender: false`, so the server renders an `aria-busy` placeholder and the
real surface mounts on the client. Toolbar actions are grouped as `blocks` (paragraph, H2, H3),
`marks` (bold, italic, underline, strike, inline code), `lists` (bullet, ordered, blockquote, code
block), and `history` (undo, redo). Buttons carry `aria-label` and `aria-pressed` and are disabled
when `editor.can().undo()` / `can().redo()` is false. The toolbar is driven by `useEditorState`,
which is why a snapshot object (`EditorSnapshot`) exists instead of re-reading the editor each
render.

Test hooks in the DOM: `data-editor-root`, `data-editor-toolbar`, `data-editor-content`,
`data-editor-placeholder`.

**The editor never sanitizes.** `onChange` hands you raw editor HTML. Run it through
`sanitizeHtml` before storing or rendering — the doc comment on `onChange` says exactly this.

## Sanitizer — `packages/ui/src/sanitize.ts`

`sanitizeHtml(dirty: string): string` runs `isomorphic-dompurify` with an explicit allowlist.

| Setting | Value |
|---|---|
| Allowed tags | `p h1 h2 h3 h4 h5 h6 ul ol li blockquote pre code hr br strong b em i u s a` |
| Allowed attributes | `href target rel` |
| `ALLOW_DATA_ATTR` | `false` |

Inline styles, scripts, event handlers, `iframe`, and `javascript:` URLs are stripped. A hook
registered once per process adds `rel="noopener noreferrer"` to any `target="_blank"` link, closing
the `window.opener` path back into the app. The function is idempotent — sanitizing sanitized HTML
returns the same string — so it is safe on read as well as on write.

```ts
import { sanitizeHtml } from "@lagan/ui";

const safe = sanitizeHtml(editorHtml);
```

Two allowlist facts worth knowing: the tag list includes `h1` and `h4`–`h6`, which the toolbar
cannot produce, and it permits `a`/`href` while `StarterKit` ships no Link extension. Link markup
therefore survives sanitization only if it arrives from pasted or programmatically set content, not
from the toolbar.

## Video — `apps/web/lib/mux.ts` and the webhook route

### Environment

| Variable | Used by |
|---|---|
| `MUX_TOKEN_ID` | `createMuxUpload` — HTTP Basic auth |
| `MUX_TOKEN_SECRET` | `createMuxUpload` |
| `MUX_WEBHOOK_SIGNING_SECRET` | webhook route — signature verification |

Missing token env throws `${name} is not set`. A missing webhook secret returns `500` before the
body is read.

### `createMuxUpload`

`POST https://api.mux.com/video/v1/uploads` with `cors_origin` set to the caller-supplied origin and
`new_asset_settings` carrying `playback_policies: ["public"]` and `passthrough: lessonId`. The lesson
id travels as the passthrough so the webhook can find the row without a lookup table. Returns
`{ id, url }`; `url` is the authenticated endpoint the browser PUTs the file body to. Throws when
the response is not ok, or when the parsed `url` is `null`.

Assets are created **public**. Signed playback policy is deferred to the entitlement work, so this
must not ship enabled before entitlement lands.

### `verifyMuxWebhookSignature(rawBody, signatureHeader, secret, toleranceMs?, now?)`

Mux signs `${timestamp}.${rawBody}` with HMAC-SHA256 under the endpoint signing secret. The header
is `t=<unix seconds>,v1=<hex digest>`; several `v1` values are accepted so a secret can be rotated
without a failed window. Fails closed on a missing header, a missing or non-numeric `t`, no `v1`,
a timestamp outside the tolerance (default 5 minutes, injectable for tests), or a digest mismatch.
Comparison is `timingSafeEqual` over decoded buffers, so a wrong signature leaks no position
information.

Verification must run on the **raw** request body. Parsing and re-serializing first changes the
bytes and breaks the digest.

### Webhook route — `apps/web/app/api/mux/webhook/route.ts`

1. Read `MUX_WEBHOOK_SIGNING_SECRET`; `500` when unset.
2. Read the body as text, verify `mux-signature`; `401` on failure.
3. Parse and validate the payload; `400` on failure.
4. Act only on `video.asset.ready` with a `passthrough` and a first `playback_ids[0].id`.
5. Update `lessons.muxPlaybackId` and `updatedAt` where `lessons.id = passthrough`.
6. Answer `{ received: true, updated: true }` when a row matched, `updated: false` otherwise, with
   `200`.

Mux retries any non-2xx delivery, so every recognized event answers 2xx even when nothing is
updated; only an unverifiable delivery is rejected. The handler is therefore idempotent by
construction — replaying `video.asset.ready` writes the same playback id.

Unhandled: `video.asset.errored`, the `video.upload.*` family, multiple playback ids, and any asset
that never becomes ready.

### Wiring gaps

- **`createMuxUpload` has no caller outside its test.** There is no upload route under
  `apps/web/app/api`. An author cannot get an upload URL today.
- **The webhook writes rows nothing creates.** `lessons.muxPlaybackId` is set by id, but lesson
  CRUD (P2.7) does not exist — only course CRUD (P2.6) shipped — so against a real database the
  update matches zero rows and answers `updated: false`.
- Playback id is taken from `playback_ids[0]` with no preference for the policy, which matters once
  signed playback is added.

## Publish flow — design sketch (not built)

No code performs this draft-to-rows publish. A `publishCourse` server action (P2.6) flips an
existing course row to `published` and stamps `publishedAt`, but nothing reads a draft. `version` is
written only by `createCourseDraft` (always `1`) and by the database default. The sketch below is
the shape the draft store and schema were built for.

| Step | Action | Notes |
|---|---|---|
| 1 | Read the draft from the store | `selectDraft(id)`; refuse when absent |
| 2 | Validate | Title non-empty, at least one module, every lesson satisfied for its `type`: `video` needs `muxPlaybackId`, `text`/`quiz` need `contentJson`, `external` needs `externalUrl`, `file` needs `fileKey` |
| 3 | Sanitize | Every `contentJson` text/quiz body through `sanitizeHtml` before it reaches the database |
| 4 | Resolve ownership | `authorId` from the session, `tenantId` from the session or config — neither is in the draft |
| 5 | Write the course | Upsert with `status`, `publishedAt`, and `version`; new course starts at `1` |
| 6 | Write modules and lessons | Array index becomes `position`. Uniqueness on `(course_id, position)` and `(module_id, position)` forces this inside one transaction |
| 7 | Flip lesson status | `lessons.status = "published"` for lessons included in the publish |
| 8 | Clear or retain the draft | Undecided — retaining it makes a later edit cheap, clearing it stops the store from holding a stale copy | 

Two points need a decision before implementation:

- **Idempotency.** Publish runs against the same draft twice on a retry. Reusing draft ids as row
  ids with an upsert makes it re-runnable; delete-then-insert also works inside the transaction but
  churns ids and breaks anything referencing a lesson.
- **Version semantics.** `version` bumps on republish, but whether `publishedAt` refreshes or holds
  the first publish time is unset. `courses.published_at` is nullable, which fits either.
- **Draft identity.** Draft ids are prefixed `course_`/`module_`/`lesson_` and optional in
  `createDraft`, so a publish that reuses them and one that mints new ids are both possible. Pick
  one; mixing them doubles the lookup paths.
