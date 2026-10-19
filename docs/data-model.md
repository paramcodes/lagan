# Data model

Reference for the Drizzle schema in `packages/db` and the committed SQL migrations in
`packages/db/drizzle/` (`0000_fresh_shooting_star.sql`, `0001_bitter_hedge_knight.sql`,
`0002_yielding_gideon.sql`).

Source files:

| File | Tables |
|---|---|
| `packages/db/src/schema/profile.ts` | `user` (mirror), `profiles` |
| `packages/db/src/schema/course.ts` | `courses`, `modules`, `lessons` |
| `packages/db/src/schema/event.ts` | `course_event` |
| `packages/db/src/schema/enrollment.ts` | `enrollments` |
| `packages/db/src/schema/progress.ts` | `lesson_progress` |
| `packages/db/src/schema/notification.ts` | `notifications` |
All are re-exported from `packages/db/src/index.ts`, which is what `apps/web` imports as
`@lagan/db`.

## Entity relationships

```mermaid
erDiagram
  user ||--o| profiles : "user_id (unique)"
  user ||--o{ courses : "author_id"
  user ||--o{ enrollments : "user_id"
  user ||--o{ lesson_progress : "user_id"
  user ||--o{ notifications : "user_id"
  user ||--o{ course_event : "user_id"
  courses ||--o{ modules : "course_id"
  courses ||--o{ enrollments : "course_id"
  courses ||--o{ lesson_progress : "course_id"
  courses ||--o{ course_event : "course_id"
  modules ||--o{ lessons : "module_id"
  lessons ||--o{ lesson_progress : "lesson_id"
  lessons ||--o{ course_event : "lesson_id (nullable)"
```

A lesson hangs off a module, never directly off a course, so reaching a course from a lesson
takes two joins. `course_event` is the one table with three parents: it points at the user,
the course and (for all but course-level events) the lesson. Deleting any parent removes its
children (see [Foreign keys](#foreign-keys-and-cascade-behaviour)).

## Conventions

**Identifiers.** Every primary key is `text`, holding a UUID the application generates
(`crypto.randomUUID()` in `apps/web/app/(app)/profile/actions.ts`). There is no
`defaultRandom()` and no database-side default, so an insert must supply an id.

**Naming.** Column names are explicit snake_case strings (`text("user_id")` → `user_id`);
the TypeScript properties are camelCase (`userId`). Every table exports singular aliases
alongside the plural binding, plus row types:

| Table | Bindings | Types |
|---|---|---|
| `profiles` | `profiles`, `profile`, `userProfiles`, `userProfile` | `Profile`, `NewProfile` |
| `courses` | `courses`, `course` | `Course`, `NewCourse` |
| `modules` | `modules`, `module` | `Module`, `NewModule` |
| `lessons` | `lessons`, `lesson` | `Lesson`, `NewLesson` |
| `course_event` | `courseEvent`, `courseEvents` | `CourseEvent`, `NewCourseEvent` |
| `enrollments` | `enrollments`, `enrollment` | `Enrollment`, `NewEnrollment` |
| `lesson_progress` | `lessonProgress`, `lesson_progress`, `lessonProgresses` | `LessonProgress`, `NewLessonProgress` |
| `notifications` | `notifications`, `notification` | `Notification`, `NewNotification` |
**Timestamps.** `timestamp(name, { withTimezone: true })` → `timestamptz`, with
`.defaultNow().notNull()` where present. `lessons` has `updated_at` but no `created_at`.

**Tenancy.** `tenant_id` is required on every table that holds institution data, from the
first migration, per [ADR-0002](adr/index.md). `courses`, `course_event`, `lesson_progress`, and
`notifications` carry it today: `tenantId` is `text().notNull()` or `varchar(64).notNull()` with
no foreign key, because no `tenants` table exists (the tenancy model is open in
[ADR-0014](adr/index.md), fork F4). The standard development value is `"default"` or a tenant id
generated per institution context.

**Money.** Stored as integer cents: `courses.price_cents`, integer, not null, default `0`.
There is no currency column; the app is single-currency. Discounts are
`discount_percent` (integer, default `0`), and `is_free` is a separate boolean rather than a
sentinel price. No `CHECK` constraint guards either range, so `0 <= discount_percent <= 100`
is a convention the application must hold.

**Status and type columns.** `courses.status`, `lessons.status` and `lessons.type` are `text`
columns carrying a TypeScript union through `$type<...>()`. They are not `pgEnum` values:
the comment in `course.ts` records that the value set can then grow without a migration that
rewrites the type, and `erasableSyntaxOnly` in `tsconfig.base.json` forbids TypeScript
`enum` anyway. A consequence to respect: the database accepts any string in these columns.
There is no `CHECK` constraint, so the union is enforced only where the application validates.

| Union / Type | Values | Used by |
|---|---|---|
| `CourseStatus` | `draft`, `published`, `archived` | `courses.status` |
| `LessonStatus` | `draft`, `published` | `lessons.status` |
| `LessonType` | `video`, `text`, `quiz`, `file`, `external` | `lessons.type` |
| `LessonContent` | `{ type: "doc"; content?: unknown[] }` | `lessons.content_json` |
| `CourseEventType` | `view`, `progress`, `complete`, `drop` | `course_event.type` |
| `NotificationPayload` | `Record<string, unknown>` | `notifications.payload` |
## `user` (mirror)

A two-column-wide mirror of Better Auth's own table, present only so other tables have a
foreign-key target. Better Auth owns the real definition at runtime; this file declares the
id.

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key |

## `profiles`

One row per user, created and updated through an upsert in
`apps/web/app/(app)/profile/actions.ts`.

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key; `crypto.randomUUID()` on insert |
| `user_id` | `userId` | `text` | no | — | Unique. FK → `user.id`, `ON DELETE CASCADE` |
| `bio` | `bio` | `text` | yes | — | Empty string is normalised to `null` by the action |
| `website_url` | `websiteUrl` | `text` | yes | — | Validated as a URL or empty string by Zod |
| `social_links_json` | `socialLinksJson` | `text` | yes | — | Serialised `Array<{ label, url }>`. Text, not `jsonb`; parsed on read with a fallback to `[]` |
| `avatar_url` | `avatarUrl` | `text` | yes | — | |
| `created_at` | `createdAt` | `timestamptz` | no | `now()` | |
| `updated_at` | `updatedAt` | `timestamptz` | no | `now()` | The action sets this explicitly on update |

The unique constraint on `user_id` is what makes the write an upsert:
`onConflictDoUpdate({ target: profiles.userId, ... })`.

## `courses`

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key |
| `tenant_id` | `tenantId` | `text` | no | — | No FK yet; see [Tenancy](#conventions) |
| `author_id` | `authorId` | `text` | no | — | FK → `user.id`, `ON DELETE CASCADE` |
| `title` | `title` | `text` | no | — | |
| `description` | `description` | `text` | yes | — | |
| `price_cents` | `priceCents` | `integer` | no | `0` | Money as integer cents |
| `discount_percent` | `discountPercent` | `integer` | no | `0` | Range enforced in app code only |
| `is_free` | `isFree` | `boolean` | no | `false` | |
| `status` | `status` | `text` (`CourseStatus`) | no | `'draft'` | |
| `version` | `version` | `integer` | no | `1` | Bumped on publish ([P2.10 #14](https://github.com/paramcodes/lagan/issues/14)) |
| `published_at` | `publishedAt` | `timestamptz` | yes | — | |
| `created_at` | `createdAt` | `timestamptz` | no | `now()` | |
| `updated_at` | `updatedAt` | `timestamptz` | no | `now()` | |

Indexes: `courses_tenant_id_idx`, `courses_author_id_idx`, `courses_status_idx` — one per
column that a list or filter query needs.

## `modules`

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key |
| `course_id` | `courseId` | `text` | no | — | FK → `courses.id`, `ON DELETE CASCADE` |
| `title` | `title` | `text` | no | — | |
| `position` | `position` | `integer` | no | `0` | Ordering inside the course; unique per course |

Indexes: `modules_course_id_idx`, and unique `modules_course_id_position_key` on
`(course_id, position)`.

## `lessons`

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key |
| `module_id` | `moduleId` | `text` | no | — | FK → `modules.id`, `ON DELETE CASCADE` |
| `type` | `type` | `text` (`LessonType`) | no | — | No default; the insert must choose |
| `title` | `title` | `text` | no | — | |
| `position` | `position` | `integer` | no | `0` | Ordering inside the module; unique per module |
| `status` | `status` | `text` (`LessonStatus`) | no | `'draft'` | Lessons publish individually, then with the course |
| `mux_playback_id` | `muxPlaybackId` | `text` | yes | — | Set by the Mux webhook on `video.asset.ready` |
| `content_json` | `contentJson` | `jsonb` (`LessonContent`) | yes | — | TiPTap document for `text` and `quiz` lessons |
| `external_url` | `externalUrl` | `text` | yes | — | For `external` lessons |
| `file_key` | `fileKey` | `text` | yes | — | Object-storage key for `file` lessons |
| `updated_at` | `updatedAt` | `timestamptz` | no | `now()` | No `created_at` column |

Indexes: `lessons_module_id_idx`, and unique `lessons_module_id_position_key` on
`(module_id, position)`.

The four payload columns are all nullable and none is tied to `type` by a constraint. Which
one a lesson uses is a convention: `content_json` for `text`/`quiz`, `mux_playback_id` for
`video`, `external_url` for `external`, `file_key` for `file`. The draft store in
`packages/ui/src/drafts.ts` mirrors exactly this shape.

## `course_event`

Append-only learner activity, read by author analytics ([P5.1 #47](https://github.com/paramcodes/lagan/issues/47),
merged as `96ea406` (#49); see [analytics feature reference](features/analytics.md)). Nothing writes a row yet.

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key |
| `tenant_id` | `tenantId` | `text` | no | — | No FK yet; see [Tenancy](#conventions) |
| `user_id` | `userId` | `text` | no | — | FK → `user.id`, `ON DELETE CASCADE` |
| `course_id` | `courseId` | `text` | no | — | FK → `courses.id`, `ON DELETE CASCADE` |
| `lesson_id` | `lessonId` | `text` | yes | — | FK → `lessons.id`, `ON DELETE CASCADE`. Null is meaningful: a `drop` fires at course level |
| `type` | `type` | `text` (`CourseEventType`) | no | — | No default; the insert must choose |
| `position_seconds` | `positionSeconds` | `integer` | no | `0` | Playback position when the event fired |
| `created_at` | `createdAt` | `timestamptz` | no | `now()` | No `updated_at`: rows are never modified |

Indexes: `course_event_tenant_id_idx`, `course_event_user_id_idx`, `course_event_course_id_idx`,
`course_event_lesson_id_idx`, and `course_event_course_id_created_at_idx` on
`(course_id, created_at)`, which is the index a per-course time-series read uses.


## `enrollments`

User entitlement records, inserted on Stripe checkout completion or free enrollment fulfillment
(see [payments feature reference](features/payments.md)).

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key |
| `user_id` | `userId` | `text` | no | — | FK → `user.id`, `ON DELETE CASCADE` |
| `course_id` | `courseId` | `text` | no | — | FK → `courses.id`, `ON DELETE CASCADE` |
| `stripe_payment_id` | `stripePaymentId` | `text` | no | — | Unique Stripe checkout session id |
| `enrolled_at` | `enrolledAt` | `timestamptz` | no | `now()` | Fulfillment timestamp |
| `course_version_seen` | `courseVersionSeen` | `integer` | no | `1` | Snapshot of `courses.version` upon enrollment |

Indexes: `enrollments_user_id_idx` on `user_id`, `enrollments_course_id_idx` on `course_id`, and
unique `enrollments_user_id_course_id_key` on `(user_id, course_id)`.

## `lesson_progress`

Per-learner progress tracking and completion state for individual lessons
(see [player and progress reference](features/player-progress.md)).

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key |
| `tenant_id` | `tenantId` | `varchar(64)` | no | — | Institutional tenant ID |
| `user_id` | `userId` | `text` | no | — | FK → `user.id`, `ON DELETE CASCADE` |
| `lesson_id` | `lessonId` | `text` | no | — | FK → `lessons.id`, `ON DELETE CASCADE` |
| `course_id` | `courseId` | `text` | no | — | FK → `courses.id`, `ON DELETE CASCADE` |
| `completed` | `completed` | `boolean` | no | `false` | True when lesson is finished or passed threshold |
| `completed_at` | `completedAt` | `timestamptz` | yes | — | Stamped upon completion |
| `position_seconds` | `positionSeconds` | `integer` | no | `0` | Media playback position in seconds |
| `last_seen_at` | `lastSeenAt` | `timestamptz` | no | `now()` | Refreshed on progress updates |

Indexes: unique `lesson_progress_user_id_lesson_id_key` on `(user_id, lesson_id)`, composite
`lesson_progress_user_id_course_id_completed_idx` on `(user_id, course_id, completed)`, and
`lesson_progress_tenant_id_idx` on `tenant_id`.

## `notifications`

Durable in-app notification rows delivered via SSE and rendered in the notification center
(see [notifications feature reference](features/notifications.md)).

| Column | TS property | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| `id` | `id` | `text` | no | — | Primary key |
| `tenant_id` | `tenantId` | `varchar(64)` | no | — | Institutional tenant ID |
| `user_id` | `userId` | `text` | no | — | FK → `user.id`, `ON DELETE CASCADE` |
| `type` | `type` | `varchar(64)` | no | — | Notification event type |
| `payload` | `payload` | `jsonb` (`NotificationPayload`) | no | `{}` | Typed structured metadata |
| `read_at` | `readAt` | `timestamptz` | yes | — | Stamped when recipient marks as read; null = unread |
| `created_at` | `createdAt` | `timestamptz` | no | `now()` | Row creation timestamp |

Indexes: composite `notifications_user_id_read_at_created_at_idx` on `(user_id, read_at, created_at)`,
and `notifications_tenant_id_idx` on `tenant_id`.
## Foreign keys and cascade behaviour

| Child | Column | Parent | On delete | Effect of deleting the parent |
|---|---|---|---|---|
| `profiles` | `user_id` | `user.id` | `CASCADE` | Profile row disappears with the user |
| `courses` | `author_id` | `user.id` | `CASCADE` | **Every course by that user is deleted, and its modules and lessons with it** |
| `modules` | `course_id` | `courses.id` | `CASCADE` | Modules and their lessons are deleted |
| `lessons` | `module_id` | `modules.id` | `CASCADE` | Lesson rows are deleted |
| `course_event` | `user_id` | `user.id` | `CASCADE` | That user's activity rows are deleted |
| `course_event` | `course_id` | `courses.id` | `CASCADE` | Activity for the course is deleted with it |
| `course_event` | `lesson_id` | `lessons.id` | `CASCADE` | Activity for the lesson is deleted with it |
| `enrollments` | `user_id` | `user.id` | `CASCADE` | Enrollment disappears when learner account is deleted |
| `enrollments` | `course_id` | `courses.id` | `CASCADE` | Enrollments disappear when course is deleted |
| `lesson_progress` | `user_id` | `user.id` | `CASCADE` | Progress history disappears with the user |
| `lesson_progress` | `course_id` | `courses.id` | `CASCADE` | Progress records deleted with course |
| `lesson_progress` | `lesson_id` | `lessons.id` | `CASCADE` | Progress records deleted with lesson |
| `notifications` | `user_id` | `user.id` | `CASCADE` | Notifications deleted with recipient user |
All seven cascades are asserted in `packages/db/src/schema/course.test.ts` and
`packages/db/src/schema/event.test.ts`, which read the table config rather than a live
database. Note the author cascade: deleting an author's account removes published courses.
If authored content must outlive its author, that constraint has to change (for example to
`SET NULL` with a nullable `author_id`), and the change is a schema migration, not an
application concern. The same deletion also removes the analytics history attached to those
courses: an activity log that must survive is a separate store, not a cascade.

## Uniqueness and ordering constraints

| Constraint | Table | Columns | Meaning |
|---|---|---|---|
| `profiles.user_id` unique | `profiles` | `user_id` | One profile per user |
| `modules_course_id_position_key` | `modules` | `(course_id, position)` | No two modules in a course share a position |
| `lessons_module_id_position_key` | `lessons` | `(module_id, position)` | No two lessons in a module share a position |
| `enrollments.stripe_payment_id` unique | `enrollments` | `stripe_payment_id` | Idempotent replay protection for Stripe checkouts |
| `enrollments_user_id_course_id_key` | `enrollments` | `(user_id, course_id)` | Single active enrollment per learner per course |
| `lesson_progress_user_id_lesson_id_key` | `lesson_progress` | `(user_id, lesson_id)` | Single progress record per learner per lesson |

`course_event` adds no unique constraint: it is an append log, so several rows can share the
same `(user_id, course_id, type)`.

Consequences for authoring:

- Positions must be unique inside their parent, so a reorder has to renumber siblings rather
  than assign a duplicate position and swap afterwards.
- `position` defaults to `0`, so a naive two-insert sequence collides on the unique index
  until positions are set explicitly.
- Array index becomes `position` on publish: `packages/ui/src/drafts.ts` documents that the
  order an author sees in the builder is the order written to the column.

## Schema state and migrations

- Migrations live in `packages/db/drizzle/` and are configured via root `drizzle.config.ts`.
  Generate migrations with `bun run db:generate` and apply them with `bun run db:migrate`
  per [ADR-0002](adr/index.md).
- Better Auth's other tables (`session`, `account`, `verification`) are not declared here;
  they are created from Better Auth's own definition at runtime.
- `course.test.ts`, `event.test.ts`, `enrollment.test.ts`, `progress.test.ts`, and `notification.test.ts`
  are the pattern for schema tests: assert column names, nullability, defaults, foreign-key targets
  and cascades, and index uniqueness through `getTableColumns` / `getTableConfig`.

## Tables that do not exist yet

These are named deliberately: any feature work that reaches for them must add the table
first. Every table holding institution data must carry `tenant_id` from its initial migration
([ADR-0002](adr/index.md)).

| Table | Purpose | Issue / Status |
|---|---|---|
| `tenants` | The institution row `tenant_id` points at, with RLS policies | Tenancy model open: [ADR-0014](adr/index.md); no issue filed |
| `submissions` / files | Student submissions and uploaded file metadata | Storage covered by [ADR-0008](adr/index.md); table schema planned |
| `audit_logs` | Security, administrative, and access audit log | Planned for enterprise compliance |

Also absent: any table for student submissions or uploaded files ([ADR-0008](adr/index.md) covers the
storage shape, not the rows), and any administrative audit log.

## Adding a table

1. Add `packages/db/src/schema/<name>.ts`, following `course.ts`: explicit snake_case names,
   `text` primary key, `tenant_id` if it holds institution data, cascading foreign keys.
2. Re-export it from `packages/db/src/index.ts`.
3. Add a test alongside it in the style of `course.test.ts`.
4. Generate the migration and review the SQL ([ADR-0002](adr/index.md)).
5. Run the gates in [`contributing.md`](contributing.md).

## Related

- [`architecture.md`](architecture.md) — how the app reaches this schema at runtime.
- [`adr/index.md`](adr/index.md) — ADR-0002 (Postgres, tenancy), ADR-0008 (submissions).
- [`contributing.md`](contributing.md) — database rules and gates.
