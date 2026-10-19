# Visual Verification Evidence

Visual evidence screenshots captured to verify core product user flows across light and dark color schemes, ensuring design token fidelity, layout integrity, and visual accessibility.

## Capture Specifications

All visual evidence artifacts are captured under standardized test environment conditions using headless Chromium via Playwright:

| Parameter | Specification | Notes |
|---|---|---|
| **Engine** | Chromium (Playwright Headless) | Sandboxed automated browser |
| **Viewport** | 1440 × 900 px | Standard desktop layout baseline |
| **Device Scale Factor** | 2.0 (HiDPI / Retina) | Renders high-resolution assets at 2880 × 1800 px |
| **Color Schemes** | Light & Dark | Explicit `colorScheme` context and `.dark` class toggle |
| **Font Rendering** | Web font settle synchronization | Waits for `document.fonts.ready` prior to capture |
| **Capture Scope** | Full page (`fullPage: true`) | Captures entire scrollable route height |
| **Output Directory** | `docs/evidence/` | Content-addressed visual verification artifacts |

## Screenshot Inventory

### Summary Matrix

| Screenshot File | Route | Viewport | Output Resolution | Color Scheme |
|---|---|---|---|---|
| [`landing-light.png`](./landing-light.png) | `/` | 1440 × 900 | 2880 × 1800 px | Light |
| [`landing-dark.png`](./landing-dark.png) | `/` | 1440 × 900 | 2880 × 1800 px | Dark |
| [`sign-in-light.png`](./sign-in-light.png) | `/sign-in` | 1440 × 900 | 2880 × 1800 px | Light |
| [`sign-in-dark.png`](./sign-in-dark.png) | `/sign-in` | 1440 × 900 | 2880 × 1800 px | Dark |
| [`courses-cards-light.png`](./courses-cards-light.png) | `/courses?view=cards` | 1440 × 900 | 2880 × 1800 px | Light |
| [`courses-cards-dark.png`](./courses-cards-dark.png) | `/courses?view=cards` | 1440 × 900 | 2880 × 1800 px | Dark |
| [`courses-ledger-light.png`](./courses-ledger-light.png) | `/courses?view=ledger` | 1440 × 900 | 2880 × 1800 px | Light |
| [`courses-ledger-dark.png`](./courses-ledger-dark.png) | `/courses?view=ledger` | 1440 × 900 | 2880 × 1800 px | Dark |
| [`learn-cards-light.png`](./learn-cards-light.png) | `/learn?view=cards` | 1440 × 900 | 2880 × 1800 px | Light |
| [`learn-cards-dark.png`](./learn-cards-dark.png) | `/learn?view=cards` | 1440 × 900 | 2880 × 1800 px | Dark |
| [`learn-ledger-light.png`](./learn-ledger-light.png) | `/learn?view=ledger` | 1440 × 900 | 2880 × 1800 px | Light |
| [`learn-ledger-dark.png`](./learn-ledger-dark.png) | `/learn?view=ledger` | 1440 × 900 | 2880 × 1800 px | Dark |
---

### Detailed Route Artifacts

#### 1. Landing Page (`/`)

- **Light Mode**: `landing-light.png` (2880 × 1800 px)
- **Dark Mode**: `landing-dark.png` (2880 × 1800 px)
- **Verified Features**:
  - Hero header hierarchy and typography scale (`text-3xl font-semibold`).
  - Primary call-to-action buttons and interactive hover tokens.
  - Brand assets and theme inversion (`.dark:invert` logomarks).
  - Background surface tokens (`bg-zinc-50` vs. `dark:bg-black`).
  - Footer and template reference links layout consistency.

#### 2. Authentication Surface (`/sign-in`)

- **Light Mode**: `sign-in-light.png` (2880 × 1800 px)
- **Dark Mode**: `sign-in-dark.png` (2880 × 1800 px)
- **Verified Features**:
  - Centered authentication card container and responsive padding.
  - Input field styling for email and password with explicit border tokens (`--color-line`).
  - Accessible form labeling, helper text, and submit action buttons.
  - Clean focus boundary and contrast compliance against canvas background (`--color-canvas`).
  - High contrast readability across both color themes without bleeding.

#### 3. Course Catalogue — Cards Grid (`/courses?view=cards`)

- **Light Mode**: `courses-cards-light.png` (2880 × 1800 px)
- **Dark Mode**: `courses-cards-dark.png` (2880 × 1800 px)
- **Verified Features**:
  - Multi-column responsive course card grid layout (`sm:grid-cols-2 lg:grid-cols-3`).
  - `CourseCard` UI component structure: course titles, metadata badges, difficulty indicators, instructor attribution, and pricing/enrollment tags.
  - Active toggle indicator on `CourseViewToggle` showing "cards" selection.
  - Surface elevations and card border delineation (`--color-surface` and `--color-line`).
  - Dark theme card background contrast and token consistency.

#### 4. Course Catalogue — Ledger View (`/courses?view=ledger`)

- **Light Mode**: `courses-ledger-light.png` (2880 × 1800 px)
- **Dark Mode**: `courses-ledger-dark.png` (2880 × 1800 px)
- **Verified Features**:
  - Compact tabular list presentation utilizing `CourseLedgerRow`.
  - Column alignment for course title, category badge, difficulty level, and lesson count.
  - Row divider line tokens and hover interaction feedback.
  - Active toggle indicator on `CourseViewToggle` showing "ledger" selection.
  - High-density readability and text contrast under both light and dark modes.

#### 5. My Learning Dashboard — Cards Grid (`/learn?view=cards`)

- **Light Mode**: `learn-cards-light.png` (2880 × 1800 px)
- **Dark Mode**: `learn-cards-dark.png` (2880 × 1800 px)
- **Verified Features**:
  - Enrolled courses rendered in responsive cards grid with surface elevations.
  - Accessible progress bar with `aria-valuenow`, percent completed, and lesson count summary (`X of Y lessons`).
  - Direct "Continue Learning" action button deep-linking to the next uncompleted lesson.
  - Course completion badges (`Completed`, `In Progress`) and next lesson indicator.
  - Active toggle indicator on `LearnViewToggle` showing "cards" selection.
  - Consistent DTCG token styling across light and dark color schemes.

#### 6. My Learning Dashboard — Ledger View (`/learn?view=ledger`)

- **Light Mode**: `learn-ledger-light.png` (2880 × 1800 px)
- **Dark Mode**: `learn-ledger-dark.png` (2880 × 1800 px)
- **Verified Features**:
  - Compact tabular list presentation utilizing `LearnerCourseRow`.
  - Course title, author attribution, inline progress bar, percent, and lesson count.
  - Direct "Continue Learning" action button deep-linking to next lesson.
  - Active toggle indicator on `LearnViewToggle` showing "ledger" selection.
  - High-density readability and token contrast under both light and dark modes.

---

## Reproduction and Automated Capture

The screenshots are generated using the automated capture script at `scripts/capture-visual-evidence.ts`:

```bash
# Ensure local database and dev server or test environment is running
bun scripts/capture-visual-evidence.ts
```

The script manages:
1. Database seeding verification for course catalogue content.
2. Next.js dev server lifecycle handling (if not already running).
3. Route pre-warming to compile Turbopack assets before browser navigation.
4. Headless browser orchestration, theme context toggling, and font synchronization.
5. High-resolution artifact generation directly into `docs/evidence/`.
