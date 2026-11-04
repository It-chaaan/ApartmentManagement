# Project facts and working agreement

## Product and architecture

- Guillermo Apartment is in Brgy. Lingunan, Valenzuela City. The repository has `frontend/` (React, Vite, TypeScript, Tailwind CSS) and `backend/` (Laravel). Local persistence uses the MySQL/MariaDB database provided by XAMPP. See the root `README.md` for setup commands and current API behavior.
- Phase 1 already provides private family staff sign-in, building and room management, and private room photo uploads. The Vite dev server proxies `/api` to Laravel. Staff endpoints use Laravel sessions and CSRF protection; uploaded files are stored privately and served through an authenticated route.
- Preserve `frontend/public/brand-mark.svg` and the existing Guillermo Apartment identity. Do not replace or redraw the logo without a request.
- The public website and the staff dashboard serve different audiences. Public screens must use an explicit, reviewed set of publishable facts and assets; they must not reuse a management response or expose staff data, private photo URLs, or unverified room availability. Keep authentication and authorization on the server.

## Confirmed property data

| Property | Confirmed layout | Lot area | Room size | Monthly rent per room |
| --- | --- | ---: | --- | ---: |
| Building 1 | 12 rooms: first floor right `1-A`, `1-B`, `1-C`; first floor left `1-D`, `1-E`, `1-F`; second floor right `2-A`, `2-B`, `2-C`; second floor left `2-D`, `2-E`, `2-F` | 200 sqm | Approximately 24–25 sqm; no exact size is confirmed for any individual room | ₱5,000 |
| Building 2 | Six rooms: first floor `1`, `2`; second floor `3`, `4`, `5`, `6` | 100 sqm | 18 sqm each | ₱4,000 |

Both buildings have furnished rooms, motorcycle parking, and individual water and electricity meters. About half of Building 2's first floor is motorcycle parking. **Lot area is not floor area.** All seeded room statuses are `unverified`; do not claim a room is currently available, reserved, or occupied without verified data.

Apartment photos are being compiled and will arrive later. Do not invent photos, use stock or AI apartment images, copy the reference image, or substitute other property imagery. Keep private staff uploads private unless an explicit publishing workflow and approval exist.

## Scope boundaries

- Phase 1 is operational staff management. Public listings, tenants, contracts, billing, and inspections are later work; do not infer that a future phase is already authorized by this file.
- Show Philippine peso values using `₱` and preserve decimal storage for rents. Describe 24–25 sqm as an approximate range, never an exact per-room measurement.
- Preserve existing data and code. Read the applicable `AGENTS.md` files before backend changes. Project guidance here supplements `backend/AGENTS.md`; it does not replace its Laravel instructions.

## Workflow and completion standard

1. Inspect the current code, root `README.md`, root `AGENTS.md`, these three guidance files, and any more specific instructions in the affected area.
2. Plan the screen or change around its audience, facts, states, and data boundary. Keep the public site persuasive through accurate property information; keep the staff dashboard efficient for frequent operational tasks.
3. Implement using existing React, Tailwind, Laravel, API, validation, and authentication patterns. Make additions small and consistent with neighboring code.
4. Review the rendered interface at desktop and phone sizes. Check overflow, readable type, visible actions, loading/empty/error states, keyboard navigation, focus visibility, and touch targets.
5. Run relevant backend tests and frontend build/lint checks. Add meaningful tests for changed data rules, permissions, or flows. Report commands, results, visual review evidence, and any remaining limitations.

A change is complete when the intended flow works end to end, private data remains protected, the interface is usable at desktop and phone sizes, and the checks relevant to the change pass.
