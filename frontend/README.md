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

The suite covers guest access, sign-in and sign-out, staff versus owner access, staff-account creation and disabling, room verification, public availability, tenancy signing and move-in, a private signed PDF, renewal and move-out, rent and utility payment corrections, meter-charge review and posting, checklists, the payment CSV, and phone navigation. Test uploads use a private directory inside the disposable test folder. Run `npm run test:e2e -- --grep utility` to focus one workflow.

## Local demo records

Run `npm run demo` from `frontend/`. It starts a separate SQLite database and private file directory under ignored `backend/storage/framework/testing/`, then serves the local public site and staff workspace on ports 15174 and 18081. The terminal prints the demo URLs and a fresh password for the demo owner and staff accounts. Keep that terminal open while reviewing; press Ctrl+C to stop. Run `npm run demo:reset` afterward to remove any demo folder left by Windows process shutdown; a new demo run also clears old demo folders after confirming both ports are free. Your normal MySQL database and uploads are untouched. Use `npm run demo:check` to seed and validate the demo API, then exit without opening a long-running preview.

The demo includes fictional tenants, room states, draft/signed/active/ended contracts, rent due and correction history, partial and overpaid utility bills, a posted meter charge and a draft reading, inspections, settlement records, and private sample files. Names and documents carry a `[DEMO]` mark, and the local preview shows a demo banner. These records are never part of the Vercel public-only build. The startup check verifies public/private access and the main read and download endpoints; the browser and backend test suites cover mutations and validation rules.
