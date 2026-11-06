# Guillermo Apartment

Guillermo Apartment is a web project for two apartment buildings and 18 rooms in Brgy. Lingunan, Valenzuela City. Visitors can explore the property and ask about rooms. Authorized family staff use a separate dashboard to keep building and room information current.

## Public website

The public site presents both buildings, their room layouts, sizes, monthly rents, shared amenities, and location. Visitors can browse rooms by building and use a Messenger inquiry link. A room is labeled available only when staff have set its status to available; other rooms invite visitors to ask for availability.

The homepage includes five curated property photos: the exterior leads, followed by a finished studio, kitchenette detail, balcony walkway, and second floor corridor. Their building and room attribution has not been confirmed, so the gallery does not assign it. Photos uploaded by staff stay private until staff approve them for public display; approved room photos appear separately with their recorded room attribution.

## Staff dashboard

The private staff workspace uses one set of pages for both buildings. Staff can switch between an all-buildings view and either building; rooms, contracts, payments, bills, checklists, and dashboard figures follow that selection, while tenant profiles remain reusable. The six pages are Dashboard, Rooms, Tenants & Contracts, Payments & Bills, Checklists, and owner-only User Management. The Dashboard shows current counts and a six-month trend of recorded rent collections. Payments & Bills separates rent from manually recorded electricity and water bills. Utility bill PDFs and payment records remain private. The workspace is at `/staff`; the public homepage is at `/`.

## Current features and roadmap

**Implemented:** public building and room sections, a curated property gallery, Messenger inquiries, staff sign-in, building views and room editing, room status tracking, private photo uploads, staff-controlled photo publishing, tenant profiles, occupancy history, contract records with private signed-file versions, manual rent payments, utility bills and partial payment history, private inspection checklists and photos, and owner-controlled staff accounts. The initial property records contain two buildings and 18 rooms. Room occupancy begins unverified.

**Rent rules:** A partial first or last month is charged at the full monthly amount. The advance stays separate from rent while a tenancy is active. When it ends, the ledger applies available advance only to unpaid final-month rent and shows any unused advance separately. The deposit is never used for rent automatically. Refunds and other settlement decisions remain staff actions outside the current ledger.

**Later work:** online payments, utility email ingestion, automatic meter-based charges, refunds, deductions, and a tenant portal. These workflows are not part of the current app.

## Project structure and technology

| Directory | Purpose |
| --- | --- |
| `frontend/` | React and TypeScript interface built with Vite and styled with Tailwind CSS |
| `backend/` | Laravel API, authentication, validation, database models, migrations, and tests |

The frontend uses Laravel's API for property data and staff actions. Laravel stores building, room, and photo records in a MySQL-compatible database; local development uses the database provided by XAMPP. The public API returns a limited set of website information, while management actions require a staff session.

## Security and development status

Staff authentication protects management data. Owners alone can create, edit, or disable staff accounts; disabled accounts cannot sign in or use an existing staff session. Photos are stored privately by default, and public access requires a separate approval. Signed contracts and utility bill PDFs require a staff session. Inputs and uploads are validated. Credentials and local environment files are excluded from Git.

The current app covers the public website and private staff operations for rooms, tenants, contracts, rent, utilities, inspections, and staff accounts. The public website continues to show only approved photos and verified availability. Signed contracts, utility bills, and tenant records remain private.
