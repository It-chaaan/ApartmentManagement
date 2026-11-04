# Laravel API

See the [project overview](../README.md) for the current public website, staff dashboard, technology, and roadmap.

## Phase 3 data and API

The session-protected `/api/tenants` and `/api/contracts` endpoints hold tenant profiles, emergency contacts, contract terms, signing payments, and historical room occupancy. They are not part of `/api/public/site`. Contract records are retained through end and renewal; a renewal references its previous contract. Signed PDFs are stored on the private local disk as separate file versions and downloaded only through a staff-authenticated route.

Creating a contract saves a draft. Staff review its dates and amounts before saving, then confirm the room as available or reserved before recording move-in. Move-in records advance and deposit paid as separate amounts and marks the room occupied. Renewing an active contract retains its prior record. Ending an active tenancy requires a review note and marks the room unverified until staff check its condition and availability. This phase does not allocate the advance to a rent month or calculate billing, deductions, refunds, or eviction actions.
