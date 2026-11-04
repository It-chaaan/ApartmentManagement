# Practical interface process

This is a project UI/UX checklist, not an installed skill. Use it when planning, implementing, and reviewing public pages and staff tools.

## Shape the interface before coding

- Identify the audience and one primary task per screen. For a homepage, make the location and verified building facts easy to understand, then offer an honest next action. For building pages, establish how the buildings differ. For staff screens, prioritize room identification, filters, status, and safe edits.
- Sketch the content order and responsive layout before choosing components. Account for real data, missing photos, long descriptions, validation errors, loading states, and zero filter matches.
- Choose one dominant visual idea per screen. Use the composition and tokens in `design-taste.md`; do not use decoration to compensate for weak content.

## Seven review questions

| Principle | Ask while reviewing this app |
| --- | --- |
| Hierarchy | Can a visitor immediately find the property name, location, confirmed facts, and next action? Can staff see building, room code, status, and rent before secondary details? |
| Progressive disclosure | Do homepage and building pages reveal useful facts first and details on demand? Do room cards summarize while details hold amenities and descriptions? Do staff forms show only controls needed for the edit, with advanced detail kept out of the initial scan? |
| Consistency | Do navigation, room cards, status labels, form fields, filters, buttons, currency, floor names, and error messages use the same patterns across screens? |
| Contrast | Are text, controls, focus rings, status cues, and disabled states legible against the pale blue and off-white surfaces? Is meaning available without color alone? |
| Proximity | Are a room's code, building, floor, size, rent, and status visually grouped? Are each field's label, help, and error adjacent? Are filters grouped with the results they change? |
| Accessibility | Can every action be reached and understood by keyboard and screen reader? Are labels, headings, dialog behavior, focus states, error announcements, and touch targets sound? Does reduced motion remove nonessential movement? |
| Alignment | Do editorial headings and supporting copy share deliberate anchors? Do building facts, room card grids, filter controls, and form columns line up at each breakpoint without cramped or accidental gaps? |

## Build and critique

- Make small details coherent: spacing, radii, line lengths, labels, hover/focus/pressed states, and the timing of feedback should feel like one system. Controls should respond promptly; show progress for slower saves and uploads, prevent duplicate submissions, and confirm success or explain failure.
- Use motion only when it clarifies feedback or a state change, such as a dialog entering or a filter result updating. Avoid decorative animation. Respect `prefers-reduced-motion` and never make information depend on animation.
- Verify interactions with touch as well as mouse and keyboard. Check tapping filters, opening room details, closing overlays, form validation, and upload selection on a phone-sized viewport.
- Critique the rendered page after implementation, rather than judging only code. Check first impression, visual weight, awkward line breaks, excessive card repetition, empty states, real-world data lengths, and errors. Make one final polish pass to fix the specific issues found.
- Record what was actually reviewed: viewport sizes, interaction paths, accessibility checks, and build/test/lint results. If a browser or device review was unavailable, say so rather than implying it happened.
