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
