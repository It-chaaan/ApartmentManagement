# Guillermo Apartment

Guillermo Apartment is a property website and staff management app for two buildings and 18 rooms in Brgy. Lingunan, Valenzuela City. Visitors can explore rooms and inquire through Messenger. Authorized family staff manage availability, tenancy records, rent, utilities, inspections, and property content in a private workspace.

The public website is at `/`; the staff workspace is at `/staff`.

## Features

| Area | What it does |
| --- | --- |
| Public website | Shows both buildings, room details, amenities, a curated property gallery, and a Messenger inquiry link. A room appears available only after staff mark it available. |
| Rooms and photos | Lets staff edit building and room information, track room status, upload private photos, and approve individual room photos for public display. |
| Tenancies and contracts | Keeps tenant profiles, occupancy history, contract terms, renewals, signing payments, and private versions of signed contract PDFs. |
| Payments and utilities | Records rent, manually entered electricity and water bills, and staff-approved meter-calculated bills from dated kWh or cubic-meter readings and a period rate. Supports partial payments, overpayments, refunds, traceable corrections, evidence-backed deposit deductions, private bill PDFs, and a staff-only reconciliation CSV. Staff can import a sample PDF from a utility email into a private review queue; only approval posts a bill. |
| Inspections | Stores private room checklists and inspection photos. |
| Staff access | Uses staff sessions and one-use six-digit email codes for management actions. Owners can manage staff accounts, reset staff passwords, and disable access. |
| Tenant portal | Staff can invite a tenant after checking identity, recover access through a new invitation, or disable access. The tenant activates through a one-use email link and can see only their own signed contract terms and recorded tenancy payments at `/tenant`. |

The dashboard can show all buildings or filter records to one building. The initial seeder creates two buildings and 18 rooms with **unverified** room status; staff must verify availability before advertising a room as available.

## Tech stack and repository layout

| Path | Technology and responsibility |
| --- | --- |
| [`frontend/`](frontend/) | React, TypeScript, Vite, and Tailwind CSS for the public site and staff workspace. |
| [`backend/`](backend/) | Laravel 13, PHP, session-protected routes, models, migrations, seeders, and PHPUnit tests. |

The frontend calls Laravel through `/api`. During local development, Vite proxies those requests to `http://127.0.0.1:8000`. Laravel's default `.env.example` uses SQLite; MySQL is also supported through Laravel's database configuration.

Tenant invitations use `FRONTEND_URL` in `backend/.env` to build the activation link. The default points to the local Vite server. Gmail SMTP delivers staff sign-in codes and tenant invitations while both app servers run locally.

## Getting started

### Prerequisites

- PHP 8.3 or newer, with the extensions required by Laravel and the selected database driver
- Composer
- Node.js and npm compatible with the versions in the lockfiles
- SQLite, or a running MySQL-compatible database if you choose MySQL

Run these commands from the repository root in PowerShell. Keep the backend and frontend servers in separate terminals.

### 1. Configure and initialize the backend

```powershell
cd backend
composer install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path database/database.sqlite)) { New-Item database/database.sqlite -ItemType File }
php artisan key:generate
php artisan migrate --seed
php artisan staff:create-owner
```

`staff:create-owner` interactively asks for a name, email, and password of at least 12 characters. It creates the first owner account only if one does not already exist. The seeder adds property data; it does not create a default login.

Each staff sign-in requires a one-use six-digit code sent to that account's email. Codes expire after five minutes, and requesting another has a one-minute cooldown. Configure a Gmail account with 2-Step Verification and an app password in `backend/.env`: set `MAIL_USERNAME` to the full Gmail address, `MAIL_PASSWORD` to the app password, and `MAIL_FROM_ADDRESS` to the same address. The example already sets `MAIL_MAILER=smtp`, `MAIL_SCHEME=smtps`, `MAIL_HOST=smtp.gmail.com`, and `MAIL_PORT=465`. Never put the app password in Git or chat. If the owner loses access to their sign-in email, run `php artisan staff:change-owner-email` locally and provide the owner password and new email. Keep the backend `APP_KEY` stable because it encrypts private contract fields and protects sign-in code hashes.

For MySQL instead of SQLite, create an empty database and update `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `backend/.env` before running migrations. Keep `backend/.env` and all credentials out of Git.

Start Laravel:

```powershell
php artisan serve --host=127.0.0.1 --port=8000
```

### 2. Install and start the frontend

In a second terminal, from the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173/`). Visit `/staff` at that same origin and sign in with the owner account. Start with the staff dashboard to verify room statuses and update property information. The Laravel server on port 8000 provides the API; the Vite URL serves the React interface during development.

## Everyday commands

| Directory | Command | Purpose |
| --- | --- | --- |
| `frontend/` | `npm run dev` | Start the Vite development server. |
| `frontend/` | `npm run build` | Type-check and build the frontend. |
| `frontend/` | `npm run lint` | Run ESLint. |
| `backend/` | `php artisan test` | Run the backend test suite. |
| `backend/` | `php artisan migrate` | Apply new database migrations. |

## How the app handles data

The public API provides only website information and approved photos. Staff routes use session authentication. Contract PDFs, utility bill PDFs, inspection photos, and tenant records stay behind staff access. Room photos uploaded by staff remain private until explicitly approved for the public site.

The rent ledger charges a full monthly amount for a partial first or last month. Advance payment stays separate while a tenancy is active; at tenancy end, available advance applies only to unpaid final-month rent, with unused advance shown separately. Deposit is never applied to rent automatically. Staff can record refunds of rent or utility overpayments and return unused advance and deposit after tenancy end. Damage deductions draw only from the deposit and require a linked move-out checklist with a repair item and private photo. Staff record refunds only after paying the tenant; the app does not transfer money. Corrections retain the original record and a reason.

Meter-based utility charges use the difference between dated readings multiplied by the rate staff enter for that billing month, rounded to centavos. The billing month follows the current reading date. A missing reading never generates an estimate or bill. Staff review a calculated draft before posting it as a utility bill; a correction to a posted charge remains pending until staff approve the revised amount. Earlier values, reasons, and approvals stay in private history. If a revised bill has an attached PDF, the old PDF is withheld until staff replace it. Manual bill entry remains available. No shared charge is added.

The five curated homepage property photos have not been confirmed as belonging to a particular building or room, so the gallery does not assign that attribution. Approved room photos appear separately with their recorded room attribution.

## Current scope

The app currently supports public browsing and private staff workflows for rooms, tenants, contracts, payments, manual and meter-based utilities, inspections, accounts, corrections, and manual settlement. Online payments remain outside the app: staff record payments after arranging them with the client. Utility email samples are uploaded manually with an unverified sender address and a private PDF; there is no connected mailbox or automatic parsing. Staff must approve a sample before it creates a bill. Tenant access is limited to the invited tenant's signed contract terms and recorded tenancy payments. Tenant files, utility bill PDFs, staff notes, and other tenants' records are not exposed in the portal; account recovery and access removal are handled by staff.

For a public-only Vercel site, use `frontend/` as the project root. Its `vercel.json` runs `npm run build:public`, which uses only confirmed property facts, shows every room as “Ask for availability,” and omits staff entry points and private uploads. The local backend and staff workspace stay local. Update the public snapshot deliberately when owner-approved property facts change; this build does not sync with the local database.

## Contributing and further documentation

For changes, follow the repository's [`AGENTS.md`](AGENTS.md) and the backend's [`backend/AGENTS.md`](backend/AGENTS.md) when working on Laravel. Run the relevant lint, build, or test command before submitting a change. The [`frontend/README.md`](frontend/README.md) describes the interface source layout; [`backend/README.md`](backend/README.md) has additional API and tenancy notes.

## License

No license for the overall repository is included. The `backend/composer.json` license field comes from the Laravel project scaffold and should not be taken as a license grant for this entire application.
