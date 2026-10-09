# Online Bar Early Access Waitlist

This folder is an independently deployable Next.js site. It uses the same Supabase project as Online Bar Admin, so waitlist signups, invite credits, souvenir requests and editable content stay connected without exposing the service-role key in browser code.

## Deploy

1. Run `supabase/WAITLIST_SITE_MIGRATION.sql` against the Online Bar Supabase project. It creates/extends the shared waitlist, private referral-token ledger, souvenir catalog and request tables, atomic reward-claim function, editable site content, and public-read-only image/audio buckets.
2. Create a separate hosting project with this folder as its root directory.
3. In the hosting project's private Production environment, set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to values from the same Supabase project as Online Bar Admin. Never prefix the service-role key with `NEXT_PUBLIC_` or expose it to the browser. Redeploy after setting environment variables.
4. Optionally set `WAITLIST_LAUNCH_AREAS` to comma-separated area names. If unset, the site reads published `settings.logistics.dispatch_zones` from the shared database.
5. In Online Bar Admin, open **Early Access Waitlist → Standalone site content** to edit the landing page, launch date, tokens per successful invite, and age-group music. Use **Waitlist phone widget & souvenirs** to add prize descriptions, token costs and images; review member redemption requests there. Admin verifies uploaded music against the live waitlist site's `/api/content` response; if it is saved but not visible there, confirm both deployments use the same Supabase project. Set `WAITLIST_PUBLIC_URL` in the Online Bar Admin environment only if the public waitlist uses a different origin from `https://theewaitlist.vercel.app`.

The standalone application lives in this repository. It writes member signups, selected experience paths, referral credits and souvenir requests to the shared Supabase project; Online Bar Admin reads those same records. Keep the site and Admin deployments on the same Supabase project and run this repository's migration before launch. The Admin remains in the Online Bar repository; the customer-facing waitlist does not.

Waitlist music starts at low volume and fades up gradually after the visitor confirms their age and enters the site. Published page content is fetched without CDN caching so newly assigned music tracks appear immediately. Signup requires an experience choice (wine tastings and gifts, hosted adventures, or the Soul Fest ticket draw); each choice is saved to `market_waitlist.reward_path` for the Admin signup list and experience summaries.

## Invites, tokens and souvenirs

Each member receives a short link in the form `/invite/OB-XXXXXXXX`. A newly inserted signup with a valid, different member's invite code earns that inviter the configured token amount. The database records at most one credit per new waitlist row and blocks self-referrals and repeat-email credits. Returning signups do not create extra referral credits.

Members can open the link shown after signup to see invited friends who joined, tokens earned/available, the launch countdown, published souvenirs and request history. Requesting a souvenir atomically reserves its token cost. Admin approval fulfils the request; rejection releases those tokens.

The `/widget` dashboard is an installable PWA/home-screen app shortcut. After signup, the success screen prompts members to open their personal dashboard and add it to their phone; the dashboard provides the browser's install prompt where supported and platform-specific fallback instructions. The shortcut opens the live countdown and referral totals. Browser-hosted sites cannot provide a live, interactive Android/iOS operating-system widget; that requires a native app/widget integration. On iPhone, use Safari's **Share → Add to Home Screen**.

The site records anonymous page opens per browser tab session, selected adult age ranges, and assigned-song starts/listens reaching 80% so Admin can compare track engagement by age group. These events are not joined to signup names, email addresses, or locations. The Admin area's signup heat map uses only the city and area members voluntarily provide when joining; it does not infer the location of all visitors from their IP addresses. Apply this repository's migration to create the restricted analytics table and Admin summary function.

Android customers can install the separate native home-screen countdown widget in `android-widget`. Build it with `.\gradlew.bat -p android-widget :app:assembleDebug -PwaitlistSiteUrl=https://<your-deployed-waitlist-origin>`. The site URL must be the deployed standalone waitlist HTTPS origin. When a customer joins through the Android app, their private member dashboard token connects the widget to real joined-friend and token balances. Do not publish or share member tokens.

The standalone site is intended for adults of legal drinking age. Uploaded music must be owned or licensed for use. Souvenir redemptions are requests subject to prize availability and Admin confirmation.
