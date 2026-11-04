# Guillermo Apartment visual direction

Use the real-estate website screenshot supplied in the conversation as a reference for **taste and composition only**. Do not copy its image, layout pixel for pixel, text, or assets. The palette values below are project proposals, except for the two logo colors read directly from `frontend/public/brand-mark.svg`; no colors were measured from the reference screenshot.

## Composition

- Place a warm off-white main canvas inside a pale powder-blue outer page background. Let the outer color frame the content, with generous margins on wide screens.
- Use near-black primary text, restrained dark buttons, and a small number of blue accents. Preserve the existing navy-and-teal logo; give it clear space so its saturated teal feels intentional rather than competing with many accent colors.
- Favor oversized editorial headings, concise supporting text, ample whitespace, compact navigation, and deliberate asymmetry. Align elements to a clear grid, then vary column widths or vertical offsets with purpose.
- Once real, approved apartment photos arrive, allow a prominent wide image area with softly rounded corners. Until then, compose public pages with typography, verified property facts, and intentional empty space. Do not display stock photos, AI-generated apartment images, the reference house image, or fake photo placeholders.
- Translate the composition for phones: single-column reading order, no horizontal scrolling, readable type, visible primary actions, and comfortable touch targets. A cropped desktop composition is not a mobile design.
- Apply the same identity more quietly in the staff dashboard: denser information, smaller headings, strong labels and status text, restrained surfaces, and fast scanning. Operational clarity takes priority over editorial drama.

## Reusable tokens

These are starting values to test in the rendered interface, not claims about the reference image. Adjust only when the result improves legibility and coherence.

| Token | Proposed value or rule | Source |
| --- | --- | --- |
| Outer background | `#E8F1F5` powder blue | Proposed |
| Main canvas | `#FAF8F3` warm off-white | Proposed |
| Primary text | `#172127` near-black | Proposed |
| Muted text | `#53636B` | Proposed |
| Border | `#D7E0E2` | Proposed |
| Dark action | `#17313D`, white text | Proposed |
| Quiet blue accent | `#587C91`; use sparingly for links or small cues | Proposed |
| Logo navy | `#0B1F3A` | Existing SVG value |
| Logo teal | `#35BFA8` | Existing SVG value |
| Heading type | Editorial serif stack such as `Georgia, Cambria, serif`; large but controlled line height around 1.0–1.1 | Proposed |
| Body/UI type | System sans stack; 16–18 px public body, 14–16 px staff UI, line height around 1.45–1.6 | Proposed |
| Spacing | 8 px base rhythm; public sections roughly 64–120 px apart on desktop, 40–72 px on phone; dashboard sections roughly 24–40 px apart | Proposed |
| Radius | 8–12 px controls, 16–20 px large image areas; avoid rounding every surface equally | Proposed |
| Interaction | Visible focus ring, at least 44 px touch targets, prompt pressed/loading feedback, short purposeful transitions; reduced motion removes nonessential transitions | Proposed |

## Do and avoid

- **Do:** lead a public page with “Two buildings in Brgy. Lingunan, Valenzuela City,” the confirmed room counts and sizes, and a clear inquiry action. **Avoid:** vague claims such as “luxury living redefined” or an unverified “rooms available now” badge.
- **Do:** let a strong heading, accurate facts, and space hold the page while photos are unavailable. **Avoid:** empty image frames that pretend a gallery exists.
- **Do:** keep staff filters close to room results and show room code, floor, size range, rent, and status in a clear scan order. **Avoid:** making every operational fact a large generic SaaS card.
- **Do:** use the logo colors with restraint and let teal remain a small brand detail. **Avoid:** excessive gradients, glass effects, decorative icons, unrelated accent colors, and needless animation.
