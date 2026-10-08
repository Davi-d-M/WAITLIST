# Online Bar Early Access Waitlist

This folder is an independently deployable Next.js waitlist site. It uses the same Supabase project as Online Bar Admin, so accepted signups appear in Admin → Early Access Waitlist without exposing the service-role key to a browser.

## Deploy

1. Run `supabase/WAITLIST_SITE_MIGRATION.sql` from this folder against the Online Bar Supabase project. It creates or extends the shared `market_waitlist` table, installs its private aggregate function, creates the editable landing-page content record, and creates public-read-only image and audio buckets. The main app's broader `DEMAND_INTELLIGENCE_MIGRATION.sql` can be installed separately when Admin → Demand Intelligence and customer area preferences are also needed.
2. Create a separate hosting project with this folder as its root directory.
3. In Vercel → Project Settings → Environment Variables, set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for **Production** (and Preview/Development if you use them). Both values must belong to the same Supabase project as Online Bar Admin. Keep the service-role key server-only; never use a `NEXT_PUBLIC_` prefix for it. Redeploy after changing environment variables.
4. Optionally set `WAITLIST_LAUNCH_AREAS` to comma-separated area names. If unset, the site reads `settings.logistics.dispatch_zones` from the shared database. With neither configured, coverage is honestly shown as unknown.
5. Install dependencies and build from this directory: `npm install`, `npm run build`. The build performs Next.js type validation; source linting in the main repository can target `waitlist-site/app`.

The app sends GPS coordinates only to its own area-resolution endpoint and never persists the coordinates. It stores the resolved area, browser-reported accuracy, explicit age confirmation, per-channel update consent, product interests, order frequency, and referral/campaign attribution. Age confirmation is not legal age verification at purchase or delivery. The included in-memory request throttle is best-effort per server instance; enable the hosting platform's edge/WAF rate limiting for production.

## Shared data

Submissions are written server-side to `public.market_waitlist`; Admin access is served by the main Online Bar application. Keep both deployments pointed at the same Supabase project. Existing storefront waitlist submissions remain compatible with the shared table.

The standalone site's visual palette follows the Online Bar brand: primary red (`#D91C1C`) with warm cream (`#F9F4EC`) and dark ink for readable contrast.

Visitors can submit a neighbourhood/area and an optional nearby landmark (for example, Sarit Centre in Westlands); both are saved for demand planning and shown in the Admin waitlist list. Coverage status is checked against Online Bar Admin's `settings.logistics.dispatch_zones`, so keep those zones current. People in configured zones are told to watch for the launch update; people outside them are told that Online Bar is coming soon and their area is recorded for expansion planning. If no zones are configured, the site avoids guessing and says coverage is still being confirmed.

The standalone landing page loads its published copy and hero image from `/api/content`, with built-in copy and artwork as a fallback. Authorized Online Bar owners/admins and settings managers can edit the eyebrow, headline, introduction, three benefit labels, image description, and hero image in Admin → Early Access Waitlist. Images are limited to JPG, PNG, WebP, and AVIF at 6 MB, uploaded server-side to Supabase Storage, and served from a public-read-only bucket. The main Admin app and standalone site must use the same Supabase project; no Admin credential or service-role key is sent to the browser.

The site asks visitors to confirm they are at least 18 and choose one of five adult age bands (18–20, 21–24, 25–34, 35–44, 45+); it does not collect dates of birth or offer an under-18 option. The band is saved only when the visitor submits the waitlist form. Admin shows aggregate counts by band. Admin can upload one licensed/owned MP3, WAV, OGG, or M4A background track per band (maximum 10 MB). Music begins only after the visitor explicitly confirms adulthood, chooses their band, and selects “Enter & play”; a visible control pauses/plays the track. Browsers do not allow reliable sound autoplay on an unprompted page load. Age confirmation remains self-reported and is not legal age verification for purchase or delivery.
