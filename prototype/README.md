# Lagan — a higher-education LMS

A clickable design prototype, plus the token set it is built from. One file, no build
step, no dependencies beyond a Google Fonts link.

```bash
xdg-open prototype/index.html
```

Ten screens hang off the left rail. **Design system** at the bottom of the rail is the
reference page — palette, type scale, spacing, shape, components, and the rules. Start
there, then click through **Today → Courses → CS 214 → Problem set 6 → Grades**. The
**Student / Teaching** switch in the rail swaps to the instructor's marking queue.

---

## The direction in one line

An academic reading room, not a SaaS dashboard: near-black ink, a neutral working grey,
black as the institutional colour, chalk yellow reserved for *you are here*, and one
typeface — Archivo — for names, reading, controls and data alike.

Two revisions after the first review. The brand was pine green (`#16603F`); it is now
near-black (`#111311`), and every neutral lost its green cast — the canvas, lines and
muted text were all tinted, and that tint was doing no work. The display serif
(Newsreader) is gone. Hierarchy now comes from scale, weight and tracking inside a
single family instead of from a second typeface.

## What the research changed

Looking at what shipped in 2026 (bento grids, kinetic typography, variable fonts, soft
spatial UI, AI-as-copilot) and at where university LMSs actually fail, a few things
mattered more than the trend list:

- **The 2026 typographic move is bold editorial type.** The first pass answered that with
  an optical-size serif; the review rejected it, and the answer now is scale and weight
  contrast inside one signage grotesque. Still not the default reach (no Inter, no
  Playfair, no two-family pair bought off a list).
- **Bento grid is the trend, and it is the wrong shape for a course list.** Sixteen
  identical rounded cards with the same shadow is the most recognisable generated-UI
  pattern there is. Courses are a *ledger* here — hairline rows, aligned numerals, much
  faster to scan.
- **The loudest complaints about Canvas and Moodle are not about beauty.** They are about
  dead ends: inflexible calendars, information spread across disconnected pages, and
  progress shown as a number with no context. Both signature devices answer that.
- **The generated-design tells were avoided deliberately** — no cream `#F4F1EA` plus
  terracotta, no acid green on near-black, no tracked-out capitals above every heading,
  no middot-joined meta strings, no mono font for small data, no `→` stapled to every
  link. The one arrow that survives is on a real button.

## Token system

### Colour

| Token | Hex | Role |
|---|---|---|
| Ink | `#0C0D0C` | Rail, headings, the one dark hero |
| Ink 2 | `#171817` | Hover and active states inside the rail |
| Canvas | `#F4F4F2` | Page background — a working grey, not cream |
| Surface | `#FFFFFF` | Panels, tables |
| Line | `#E0E1DE` | Borders and table rules |
| Brand | `#111311` | Primary actions, links, on-pace progress. 18.8:1 on white |
| Brand soft | `#E9EAE7` | Course codes, completed markers |
| Chalk | `#F2E679` | The only loud colour. Position, never decoration |
| Due | `#8A5200` on `#FBEFD6` | Something is due soon |
| Alert | `#A62B22` on `#FAE7E4` | Overdue or missing |

Amber and red are reserved for time. Nothing else may use them. Chalk is the only other
chroma, and it is reserved for position.

### Type

Archivo, one family, four tempos: 600 for names and headline figures, 500 for controls,
400 for reading, tabular for every number. Body sits at 15px/1.6 with line lengths under
80 characters. Display and heading sizes are tracked tighter than body (−2.8% to −3%)
because a grotesque at 44px sets too loose at its default spacing.

### Shape

Three radii chosen by role — 14px panel, 10px control, 7px chip, plus pills. A panel at
rest gets a hairline, never a shadow; only things that genuinely float (menus, popovers)
cast one. That single rule is what stops a dense screen turning into a stack of cards.

## The two devices

These carry the design. Everything else is deliberately quiet.

**The term spine.** Every student question begins with *where am I*. Fifteen dots run down
the left of the content — filled behind you, chalk on today, dashed through the reading
week. It is sticky while the content scrolls and turns into a horizontal strip under
1180px.

**The pace bar.** "52% complete" is a number without a meaning. The grey tick marks where
the term should have put you; the fill shows where you actually are. The gap sets the
colour: ink on pace, amber within 15 points, red beyond. On the demo data BIO 130 is 22
points behind and says so.

## Screens

| Screen | What it demonstrates |
|---|---|
| Today | The hero moment, the deadline ledger, the overdue state, pace and week sidebars |
| Courses | A scannable course list rather than a card grid |
| Course | Course header, tabbed content, module accordion, locked and completed item states |
| Problem set 6 | Reading layout, rubric table, submission panel with uploads, prior feedback |
| Grades | Summary strip, marks table, distribution chart with a text alternative |
| To grade | Instructor queue sorted by waiting time, then a speed-grader with rubric inputs |
| Calendar | Week timetable with deadlines as events |
| Inbox / Library | Message reading pane, library reserves table |
| Design system | Palette, type specimen, spacing, shape, components, do/don't, access notes |

## Limitations

- Static data. Nothing persists; buttons that would mutate state are inert.
- All four rail courses open the same CS 214 page.
- Google Fonts is a network dependency. Offline, Archivo falls back to the system sans and
  the layout holds; only the tighter tracking is lost.
- Row-level actions (`read`, `Open`, `Request a remark`) are visual only.
