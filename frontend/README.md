# Guillermo Apartment frontend

React, Vite, TypeScript, and Tailwind CSS power the public website and private staff dashboard. The public page is at `/`; staff use `/staff`.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/app/` | App entry and route selection |
| `src/pages/` | Public homepage and staff dashboard |
| `src/components/` | Reusable interface pieces, grouped by audience |
| `src/hooks/` | React data and state hooks |
| `src/api/` | Shared HTTP request handling |
| `src/services/` | Public and staff API operations |
| `src/types/` | API response and form types |
| `src/utils/` | Property formatting and form conversion |
| `src/styles/` | Global and public website styles |
| `src/assets/` | Source assets retained for future use |
| `public/` | Static files, including the existing brand mark |

Keep public data requests separate from staff requests. Uploaded room photos remain private until staff approve them through the existing workflow. See the [project overview](../README.md) for implemented features and roadmap.

`npm run build:public` creates the public-only Vercel build. Set the Vercel project root to `frontend/`; `vercel.json` selects that build. It uses the confirmed static data in `src/data/staticPublicSite.ts`, does not call a local API, labels all room availability as “Ask,” and omits the staff sign-in links. The normal `npm run build` keeps the local API-driven public site and staff workspace.

## Browser workflow tests

From `frontend/`, install the test browser once with `$env:PLAYWRIGHT_BROWSERS_PATH='0'; npx playwright install chromium --only-shell` in PowerShell, then run `npm run test:e2e`. The runner starts Laravel and Vite on ports 18080 and 15173, creates a fresh SQLite database under ignored `backend/storage/framework/testing/`, seeds test-only owner and staff accounts, and removes the database when the run ends. It refuses to run if either port is already occupied. The test password is generated for each run; no real account or MySQL data is used. Playwright screenshots and traces from failures are in ignored `frontend/test-results/`.

The suite covers guest access, sign-in and sign-out, staff versus owner access, staff-account creation and disabling, room verification, public availability, tenancy signing and move-in, rent and utility payment corrections, checklists, the payment CSV, and phone navigation. Run `npm run test:e2e -- --grep utility` to focus one workflow.
