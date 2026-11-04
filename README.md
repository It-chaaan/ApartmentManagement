# Guillermo Apartment

Guillermo Apartment is a web project for two apartment buildings and 18 rooms in Brgy. Lingunan, Valenzuela City. Visitors can explore the property and ask about rooms. Authorized family staff use a separate dashboard to keep building and room information current.

## Public website

The public site presents both buildings, their room layouts, sizes, monthly rents, shared amenities, and location. Visitors can browse rooms by building and use a Messenger inquiry link. A room is labeled available only when staff have set its status to available; other rooms invite visitors to ask for availability.

The layout works without apartment photos. Photos uploaded by staff stay private until staff approve them for public display. Approved photos can appear in the site's feature area and gallery.

## Staff dashboard

The private dashboard lets authorized staff sign in, view the two buildings, filter rooms by building, floor, and status, edit room details, and upload photos. Staff can approve or revoke a photo's public visibility separately from its room status. Staff can also maintain tenant contact and emergency details, prepare contracts, record move-in amounts, manage renewals and occupancy history, and keep signed PDF versions private. The dashboard is available at `/staff`; the public homepage is at `/`.

## Current features and roadmap

**Implemented:** public building and room sections, Messenger inquiries, staff sign-in, building views and room editing, room status tracking, private photo uploads, staff-controlled photo publishing, tenant profiles, occupancy history, and contract records with private signed-file versions. The initial property records contain two buildings and 18 rooms. Room occupancy begins unverified, and apartment photos have not been supplied.

**Later work:** monthly billing, online payments, refunds, deductions, a tenant portal, and inspection checklists. These workflows are not part of the current app.

## Project structure and technology

| Directory | Purpose |
| --- | --- |
| `frontend/` | React and TypeScript interface built with Vite and styled with Tailwind CSS |
| `backend/` | Laravel API, authentication, validation, database models, migrations, and tests |

The frontend uses Laravel's API for property data and staff actions. Laravel stores building, room, and photo records in a MySQL-compatible database; local development uses the database provided by XAMPP. The public API returns a limited set of website information, while management actions require a staff session.

## Security and development status

Staff authentication protects management data. Photos are stored privately by default, and public access requires a separate approval. Inputs and uploads are validated. Credentials and local environment files are excluded from Git.

Phases 1 through 3 cover the staff dashboard, public website, tenants, occupancy, and contracts. The public website continues to show only approved photos and verified availability. Signed contracts and tenant records remain private.
