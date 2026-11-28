# Design system

The single source of truth is the `:root` block at the top of `assets/css/main.css`.
Every page uses those tokens; nothing below them should hard-code a size, colour,
radius or gap. Change a token, not a value.

## 1. Requirements

**What it has to do**
- Make every page feel like one site: same type steps, same spacing rhythm, same
  button, same corners.
- Give each homepage section exactly one screen (title and content seen together).
- Keep the cursor visible on every surface.

**Constraints**
- Free and open source only; fast to load (no build step, self-hosted fonts).
- Palette is fixed: white page, cream surfaces, ink, pink accent used sparingly.
- Thin, light display type (Sejal's preference), but with a real hierarchy.

## 2. Evidence: what the reference sites do (measured at 1440px wide)

| Role                 | Double Play | Huge    | Collins | Ragged Edge | Jack Elder | **Ours** |
|----------------------|-------------|---------|---------|-------------|------------|----------|
| One big statement    | 72          | 96–145  | 72      | 82          | 88         | **80**   |
| Section title        | 58          | 57      | 36–40   | 78          | 56         | **56**   |
| Project/panel title  | 23          | 43      | 28      | 40          | 48         | **33**   |
| Card title, numbers  | 23          | 25–32   | 28      | 20–40       | 24–32      | **26**   |
| Body                 | 17          | 19      | 16      | 20          | 16         | **17**   |
| Small, nav           | 13–15       | 14–16   | 14      | 14–16       | 16         | **14**   |
| Caption              | 12          | —       | 12      | 12          | —          | **12**   |

Patterns: steps of about 1.25–1.33x; section titles around 56px; only one
statement per screen goes bigger; tight tracking on large sizes; four of the
five pair a sans with a serif or italic accent.

## 3. Tokens

**Colour**: `--paper` #FFF page · `--cream` #F7F5F0 surfaces (cards, tiles; after
Huge's #FAF8F4 and Collins' #F8F8F7) · `--cream-2` #EFECE5 hover · `--ink` #121011 ·
`--ink-soft` #6E6764 secondary text · `--on-dark` #F7F5F0 text on ink · `--pink` #FF0592
accent only.

**Type** (fluid; value at 1440px in brackets)

| Token         | Size                         | Weight | Line height | Tracking | Used for |
|---------------|------------------------------|--------|-------------|----------|----------|
| `--t-display` | clamp(40, 5.6vw, 96) (80)    | 300    | 1.0         | -0.045em | intro line, puzzle line, page heads, result numbers |
| `--t-h2`      | clamp(34, 3.9vw, 64) (56)    | 300    | 1.02        | -0.04em  | every section title, footer line, Say hi |
| `--t-h3`      | clamp(26, 2.3vw, 36) (33)    | 300    | 1.08        | -0.035em | project titles, process headlines |
| `--t-h4`      | clamp(20, 1.8vw, 28) (26)    | 300–400| 1.1         | -0.03em  | brand tiles, number rows, process tabs |
| `--t-lead`    | clamp(18, 1.45vw, 22) (21)   | 300    | 1.45        | -0.02em  | intro paragraphs |
| `--t-body`    | 17                           | 400    | 1.5         | -0.01em  | body |
| `--t-small`   | 14                           | 400–450| 1.5         |          | secondary text, nav, small buttons |
| `--t-caption` | 12                           | 400    | 1.35        |          | fine print under numbers |
| `--t-label`   | 11 mono, uppercase           | 400    | 1.4         | 0.14em   | labels and kickers |

**Space** (8-point): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 (`--s1`…`--s10`).
`--gutter` clamp(20, 3.2vw, 48) · `--sec-top` clamp(96, 9vw, 128) (clears the nav) ·
`--sec-bottom` clamp(48, 5vw, 80) · `--title-gap` clamp(32, 3.4vw, 48).

**Shape**: `--r-sm` 12 (small boxes) · `--r-md` 20 (cards, tiles, images) ·
`--r-lg` 28 (large panels) · `--r-pill` 999.

## 4. Components

- **Button** (`.btn`, the only one): ink pill; a pink circle with an arrow sits at
  the start and slides to the end on hover (after Morer). Sizes: `.btn--sm` 40px
  (nav), default 52px, `.btn--xl` 80–128px (Say hi, turns pink on hover).
  `.btn--light` on dark surfaces. `.btn.is-soon` for things not ready.
- **Pill** (`.pill`): glass navigation and filter chips only, never a call to action.
- **Icon button** (`.icon-btn`): 48px circle for arrows.
- **Section** (`.sec`, `.sec--full`): same top and bottom space everywhere; `--full`
  makes it one screen tall with content centred. Titles (`.sec-title`) are always
  centred and always `--t-h2`.
- **Cursor**: a 10px ring with a 1px line. It is ink over light surfaces and cream
  over dark ones (anything marked `data-dark`, the footer, the loader, the hero
  while the rays show), with a faint halo for mid tones. No blend modes.

## 5. Trade-offs

- **Light (300) display weight** vs the 500 the references use: kept, because thin
  type is part of the site's voice. It is offset by smaller, better-spaced steps,
  so it reads as deliberate, not weak.
- **One-screen sections** give a calm, poster-like rhythm but cap how much each
  section can hold. Anything longer belongs on its own page (case studies, Backyard).
- **Colour-switching cursor** costs a hit test every six frames; cheap, and it is
  the only way to stay visible over images and gradients.
- **Fluid sizes with clamps** mean no breakpoint jumps for type, but sizes must be
  checked at the extremes (360px phones, 1920px screens) after any token change.

## 6. Revisit when

- Real case study images and videos arrive (check text space on the left of each).
- The font pairing is chosen (only `--sans` and an accent token change).
- The footer and "What I'm good at" are redesigned.
