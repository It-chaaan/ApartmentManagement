# Guillermo Apartment — Phases 1 and 2

Public apartment website and private family staff dashboard for two buildings and 18 rooms in Brgy. Lingunan, Valenzuela City. Tenants, contracts, billing, and inspections are later phases.

## Requirements

- PHP 8.3 or newer, Composer, Node.js, npm, and XAMPP MySQL/MariaDB.
- Run all commands from this project directory unless a `cd` is shown.

## Local setup (PowerShell)

1. Start MySQL in the XAMPP Control Panel. Create an empty database, for example with XAMPP's MySQL shell:

   ```sql
   CREATE DATABASE guillermo_apartment CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Configure Laravel:

   ```powershell
   cd backend
   composer install
   Copy-Item .env.example .env
   php artisan key:generate
   ```

   Set these values in `backend/.env` for your local XAMPP database. Use your actual MySQL credentials. Do not commit `.env`.

   ```dotenv
   APP_NAME="Guillermo Apartment"
   APP_URL=http://127.0.0.1:8000
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=guillermo_apartment
   DB_USERNAME=root
   DB_PASSWORD=
   SESSION_DRIVER=database
   ```

3. Migrate and seed. The seeder is safe to rerun: it creates missing buildings and rooms, and preserves edited room records.

   ```powershell
   php artisan migrate
   php artisan db:seed
   ```

4. Create the first owner interactively. The password is entered at a hidden prompt, must be at least 12 characters, is hashed by Laravel, and is never stored in source code. The command refuses a second owner.

   ```powershell
   php artisan staff:create-owner
   ```

5. Start the backend and frontend in separate terminals:

   ```powershell
   cd backend
   php artisan serve --host=127.0.0.1 --port=8000
   ```

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open the Vite URL shown by `npm run dev`. With Vite's default port, the public homepage is **http://127.0.0.1:5173/** and staff sign-in is **http://127.0.0.1:5173/staff**. Vite proxies `/api` to Laravel at `127.0.0.1:8000`. Use one hostname consistently, as the staff session cookie is tied to it.

## Public website and photo publishing

The homepage shows both buildings, confirmed amenities and room layout, a room directory, location, and Messenger inquiry actions. It works without apartment photos. When real photos arrive, staff can upload them in a room's `/staff` details panel, then select **Approve for website** for each photo. Uploads start private; approval is separate from the room's occupancy status. **Remove approval** revokes public access. An approved photo can appear in the wide homepage image area and the gallery without a layout change.

Visitors use `GET /api/public/site`, which returns an explicit set of website fields. It reports a room as `available` only when its stored status is `available`; `unverified`, `reserved`, `occupied`, and `maintenance` all produce `ask`. The public response omits raw occupancy status, staff accounts, private file paths, and private photo metadata. `GET /api/public/photos/{photo}` serves only approved photos and returns 404 for private or revoked photos. Public image responses use `Cache-Control: no-store` so revoked approval does not linger in a browser cache.

## Staff and data

There is no public registration. An owner can create a staff account through the authenticated `POST /api/staff` endpoint with `name`, `email`, `password`, and matching `password_confirmation`; passwords must be at least 12 characters. Only an owner session may call it. Existing staff can sign in, view the two buildings and their rooms, filter by building/floor/status, edit rooms, and upload room photos.

Management endpoints and private photo URLs require a staff session. The frontend obtains a CSRF token from `GET /api/csrf` before mutating requests. Login attempts are rate limited. Valid uploads are JPEG, PNG, or WebP up to 5 MB, stored on Laravel's private local disk and served through the authenticated photo route. Staff may approve or revoke a photo with the details-panel control (`PATCH /api/photos/{photo}/visibility`, `is_public: true|false`). Run both apps behind HTTPS before any remote deployment and set production session/cookie configuration there.

Building 1 has a **200 sqm lot area**, 12 rooms of **approximately 24–25 sqm**, and ₱5,000 monthly rent per room. Building 2 has a **100 sqm lot area**, six 18 sqm rooms, and ₱4,000 monthly rent per room. All seeded room statuses are `unverified`; staff must verify them before treating any room as available.

## Checks

```powershell
cd backend
php artisan test
cd ..\frontend
npm run build
npm run lint
```

Phase 2 keeps the public response separate from management data. No tenants, payment records, fabricated photos, or public availability data are seeded.
