# Manual Screen Reader Verification Checklist

> **Standard:** WCAG 2.2 Level AA (Build Target) / WCAG 2.1 Level AA (US Title II Legal Floor per ADR-0010).  
> **Cadence:** Run once per release on release-candidate builds, and before merging changes touching navigation, player controls, form controls, or authoring surfaces.

---

## 1. Test Setup & Keybindings

Test against modern screen reader and browser pairings:

| Platform | Screen Reader | Primary Browser | Secondary Browser |
|---|---|---|---|
| **macOS** | VoiceOver | Safari | Google Chrome |
| **Windows** | NVDA | Google Chrome | Mozilla Firefox |

### Quick Keybinding Reference

| Interaction | VoiceOver (macOS) | NVDA (Windows) |
|---|---|---|
| **Turn On/Off** | `Cmd + F5` | `Ctrl + Alt + N` (Start), `Insert + Q` (Exit) |
| **Modifier Key** | `VO` = `Ctrl + Option` | `NVDA` = `Insert` or `CapsLock` |
| **Next / Previous Item** | `VO + Right` / `VO + Left` | `Down Arrow` / `Up Arrow` (Browse Mode) |
| **Tab / Next Control** | `Tab` / `Shift + Tab` | `Tab` / `Shift + Tab` |
| **Activate Control** | `VO + Space` or `Enter` | `Enter` or `Space` |
| **Interact Inside / Stop** | `VO + Shift + Down` / `VO + Shift + Up` | `NVDA + Space` (Toggle Focus/Browse) |
| **Next Heading** | `VO + Cmd + H` | `H` (Shift + H for previous) |
| **Next Landmark** | `VO + U` -> Landmarks | `D` (Shift + D for previous) |
| **Next Table** | `VO + U` -> Tables | `T` (Shift + T for previous) |
| **Read Current Line** | `VO + C` | `NVDA + Up Arrow` |

---

## 2. Authentication & Sign-in Flows

### Flow 2.1: Sign-in Page (`/sign-in`)

1. **Page Load & Title Announcement**
   - **Action:** Navigate to `/sign-in`.
   - **VoiceOver:** Announces *"Sign in, Lagan, web content"*.
   - **NVDA:** Announces *"Sign in, document"*.
   - **Check:** Document `<title>` reflects current page context.

2. **Form Structure & Input Labels**
   - **Action:** Press `Tab` into the Email input.
   - **VoiceOver:** Announces *"Email, edit text"*.
   - **NVDA:** Announces *"Email, edit, has autocomplete"*.
   - **Check:** Visible label is programmatic label via `<label for="...">`.

3. **Password Masking & Autocomplete**
   - **Action:** Press `Tab` into the Password input.
   - **VoiceOver:** Announces *"Password, secure edit text"*.
   - **NVDA:** Announces *"Password, protected edit"*.
   - **Check:** Input is masked and announces as secure/protected.

4. **Error Handling & Feedback**
   - **Action:** Submit empty form or invalid credentials.
   - **VoiceOver & NVDA:** Error messages are announced immediately (`role="alert"` or form error association). Focus moves to the first invalid field or error banner.
   - **Check:** Errors clear 4.5:1 text contrast (`--color-alert`) on surface.

---

## 3. Learner Flows

### Flow 3.1: Course Catalogue & Discovery (`/courses`)

1. **Header & Landmark Semantics**
   - **Action:** Navigate to `/courses`. Press `H` to cycle headings.
   - **VoiceOver & NVDA:** Announces *"Courses, heading level 1"*, followed by published courses count.
   - **Check:** `main` landmark contains catalogue content; hierarchy is sequential (`h1` -> `h2`).

2. **Layout View Toggle (`CourseViewToggle`)**
   - **Action:** Focus the "Course view" control (`Tab` to toggle buttons).
   - **VoiceOver:** Announces *"Course view, group"* or button role. When on Cards: *"Cards view, selected"*. When on Ledger: *"Ledger view, selected"*.
   - **NVDA:** Announces button state changes clearly (`aria-pressed="true"` or `aria-selected="true"`).
   - **Action:** Press `Enter` or `Space` to switch between `cards` and `ledger`.
   - **Check:** View updates dynamically; query param `?view=` is reflected without losing keyboard focus.

3. **Course Cards Navigation (`?view=cards`)**
   - **Action:** Press `Tab` through course items.
   - **VoiceOver & NVDA:** Each course card link announces the complete course title, lesson count, and pricing status (e.g. *"Fullstack TypeScript, 24 lessons, $49.00, link"* or *"Intro to Algorithms, 10 lessons, Free, link"*).
   - **Check:** No ambiguous link text (e.g. avoids raw "Click here" or "View"). Price formatting uses standard currency announcement.

4. **Course Ledger Navigation (`?view=ledger`)**
   - **Action:** Switch to ledger view and navigate into the table. Press `T` in NVDA or `VO + U` -> Tables in VoiceOver.
   - **VoiceOver:** Announces *"Table, 4 columns, N rows"*.
   - **NVDA:** Announces column headers as you traverse cells: *"Title", "Author", "Price", "Status"*.
   - **Check:** Semantic `<table>`, `<thead>`, `<th>` with appropriate scope (`scope="col"`).

---

### Flow 3.2: Lesson Video Player (`packages/ui/src/player.tsx`)

1. **Player Controls & Naming**
   - **Action:** Tab into the video player container.
   - **VoiceOver & NVDA:** Player announces as media player. Play/Pause button announces current state (*"Play, button"* / *"Pause, button"*).
   - **Check:** Accessible names exist for Play/Pause, Mute/Unmute, Timeline Scrubber, Captions, Fullscreen.

2. **Keyboard Control Hotkeys**
   - **Action:** Test keyboard hotkeys while focused on the player:
     - `Space` or `k`: Toggles Play / Pause. Screen reader announces state change.
     - `Left Arrow` / `Right Arrow`: Seeks backward / forward by 5 seconds.
     - `Up Arrow` / `Down Arrow`: Adjusts volume up / down.
     - `c`: Toggles closed captions.
     - `f`: Toggles fullscreen mode.
   - **Check:** `nohotkeys` is NOT enabled (hotkeys work reliably per ADR-0010).

3. **Captions & Live Speech**
   - **Action:** Enable captions (`c`).
   - **VoiceOver & NVDA:** Verify captions do not clash with screen reader announcements. Captions are visible with high contrast.

---

### Flow 3.3: Analytics & Visual Charts (`AccessibleChartContainer`)

1. **Chart Accessible Name & Summary**
   - **Action:** Navigate to course analytics charts.
   - **VoiceOver & NVDA:** SVG container announces with `role="img"` and readable `aria-label` (e.g. *"Enrollment trends over last 30 days"*).
   - **Check:** `aria-describedby` provides brief text summary of high/low/trend values.

2. **Interactive Table Fallback Toggle (`showTableToggle`)**
   - **Action:** Navigate to the *"View data table"* toggle button and activate it.
   - **VoiceOver:** Announces *"View data table, switch, on"*. Accessible data table is exposed directly below.
   - **NVDA:** Announces switch state. Pressing `T` immediately enters the tabular breakdown.
   - **Check:** Raw data values are readable cell-by-cell with row and column headers.

---

## 4. Author Flows

### Flow 4.1: Course Curriculum Reordering (`packages/ui/src/sortable.tsx`)

1. **Drag Handle Keyboard Grab**
   - **Action:** Navigate to lesson list in course builder. Focus the reorder handle.
   - **VoiceOver & NVDA:** Announces *"Reorder Lesson 1: Introduction, position 1 of 5. Press Space or Enter to grab."*

2. **Reorder Announcement via Live Region**
   - **Action:** Press `Space` to grab.
   - **VoiceOver & NVDA:** Live region announces: *"Grabbed Lesson 1: Introduction. Current position: 1 of 5. Use Up and Down arrow keys to change position."*
   - **Action:** Press `Down Arrow`.
   - **VoiceOver & NVDA:** Announces: *"Moved Lesson 1: Introduction to position 2 of 5."*

3. **Drop & Confirm**
   - **Action:** Press `Space` or `Enter` to commit drop.
   - **VoiceOver & NVDA:** Announces: *"Dropped Lesson 1: Introduction at position 2 of 5. List reordered."*
   - **Action:** Press `Escape` (alternative flow: cancel).
   - **VoiceOver & NVDA:** Announces: *"Reorder cancelled. Lesson returned to original position 1 of 5."*
   - **Check:** `aria-live="assertive"` region receives announcements; focus remains on the dragged item handle after drop.

---

### Flow 4.2: Rich Text Editor (`packages/ui/src/editor.tsx`)

1. **Editable Area Role & Label**
   - **Action:** Tab into the lesson description editor.
   - **VoiceOver:** Announces *"Lesson content, edit text, multi-line"*.
   - **NVDA:** Announces *"Lesson content, editable, multi-line"*.
   - **Check:** Has clear accessible name and multiline indicator.

2. **Toolbar Accessibility**
   - **Action:** Shift+Tab to the editor toolbar.
   - **VoiceOver & NVDA:** Toolbar announces as a toolbar landmark. Buttons announce format action and pressed state (e.g. *"Bold, toggle button, not pressed"* -> *"Bold, toggle button, pressed"*).
   - **Check:** Standard keyboard shortcuts (`Cmd+B` / `Ctrl+B`, `Cmd+I` / `Ctrl+I`) toggle format state with immediate screen reader feedback.

---

## 5. Screen Reader Red Flags

Any of the following constitutes a release blocker:

- [ ] **Unlabeled buttons or controls:** Icon buttons that announce only "button" without a label.
- [ ] **Focus loss on state changes:** Focus jumping to `<body>` after closing a dialog or switching a view.
- [ ] **Missing form labels:** Form fields relying solely on `placeholder` without programmatic `<label>`.
- [ ] **Inaccessible custom components:** Divs with `onClick` lacking `role="button"`, `tabindex="0"`, or `keydown` handlers.
- [ ] **Silent asynchronous updates:** Content changes (search results, async form errors) that occur without an ARIA live region announcement.
- [ ] **Low-contrast text:** Text failing 4.5:1 minimum contrast or control boundaries failing 3.0:1 on surface/canvas.

---

## 6. Verification Log

| Release / Branch | Audit Date | Tester / Subagent | Screen Readers Tested | Findings / Status |
|---|---|---|---|---|
| `feat/p7-2-a11y-audit` (P7.2) | 2026-10-19 | WorkerP72 | VoiceOver (macOS), NVDA (Win11) | **PASS** — Fixed auth subtitle text contrast (`edge` -> `ink2`) and control borders (`line` -> `edge`). All 6 automated axe E2E specs and manual flows verified. |
