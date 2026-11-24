# Sejal Jain — portfolio (v2)

Plain HTML, CSS and JavaScript. No build step, no paid services.

## Pages
| File | Page |
| --- | --- |
| `index.html` | Home: loader with sound choice, liquid-paint hero, selected work, results, brands, skills, puzzle reveal, contact |
| `case-blog.html` | Case study 01: blog design at a B2B SaaS company (anonymous, hidden from search) |
| `case-linen.html` | Case study 02: D2C home linen brand (anonymous) |
| `backyard.html` | Brand-by-brand work: endless strip + index |
| `about.html` | About, places worked, how I work |
| `404.html` | Missing piece |

## Palette
| Token | Hex | Use |
| --- | --- | --- |
| pink | `#FF0592` | Accent, buttons (black text), big numbers |
| pink-hover / press | `#E8007F` / `#C4006B` | Button states |
| pink-soft | `#FFD3EA` | Tints |
| cream / cream-2 / cream-3 | `#F5F0E6` / `#ECE5D8` / `#DED4C2` | Backgrounds, cards, lines |
| ink / ink-2 / ink-soft | `#121011` / `#26211F` / `#6E6764` | Text, dark sections, secondary text |

Contrast rule: pink is never used for small text on cream (3.2:1). Black on pink passes (5.3:1).

## What it's built with (all free)
- **GSAP + ScrollTrigger** (`assets/vendor`): scroll animation. Free for commercial use under GSAP's "Standard No Charge" licence (gsap.com/standard-license).
- **Fonts** (`assets/fonts`): Geist and Grenze Gotisch, both SIL Open Font License (licence files included), subset to Latin.
- **Hero paint**: one hand-written WebGL shader (`assets/js/hero.js`), no library.
- **Sound**: generated in the browser with Web Audio (`assets/js/site.js`), no audio files.
- **Page transitions**: the browser's built-in View Transitions (Chrome, Edge, Safari); other browsers just load normally.

## Before launch
- Replace placeholder art (`.art-*` blocks) with real mockups; add `resume.pdf`.
- Confirm: brand years/studios on the backyard and homepage, the 3× blog conversion figure, award names.
- Host free on GitHub Pages, Netlify or Vercel.
