---
name: add-stripe-subscriptions
description: Add paid subscriptions (monthly and yearly) with Stripe to a web app that runs on a Node/Express server (for example Google Cloud Run) with Firebase or another database. Use whenever the user wants to take payments, add a paywall or upgrade screen, set up Stripe, connect Stripe to an app, create a webhook, or unlock Pro features after payment. Written for a non-coder: one small step at a time.
---

# Add Stripe subscriptions to an app

This is a playbook written after doing it once for real (CA Homeschool Align, Oct 2026), including the
mistakes. Follow it in order. The person is NOT a coder: explain every technical word the first time,
give ONE step at a time with exact clicks, say what they should see, and ask for a screenshot.
Say "I don't know" or "my best guess" when unsure. Stripe changes its screens often, so the screen
descriptions below are a best guess; trust the screenshot over this file.

## Golden rules
1. **Never ask the person to paste a secret into chat.** Secrets: anything starting `sk_`, `rk_`, `whsec_`, an API key, a password. They paste secrets ONLY into their hosting settings. A `price_...` ID or `prod_...` ID is NOT a secret and is fine to paste into chat (this avoids typing mistakes: I/l/1 look alike in screenshots).
2. **One step at a time.** Wait for the screenshot or "done" before the next step.
3. **Ask a question before irreversible choices.** A Stripe price's type (one-time vs auto-renewing) cannot be changed after saving.
4. **Money and wording:** do not promise "unlimited" anything if limits exist. Auto-renewing plans need clear renewal wording and an easy way to cancel (US rules on automatic renewal). Not legal advice.
5. Keep the app's own name out of Stripe product names if the app may be renamed (use "Premium License"-style names).

## What you are building (explain it with this picture)
- The app in the browser = the hallway bulletin board. Anyone can look at it, so no secrets there.
- The **server** = the locked front office. A computer at the host (Google Cloud Run, etc.) that families never see.
- The **secret key** = the key to the office filing cabinet. It lives only in the office (host settings).
- The **webhook** = Stripe phoning the office: "this family paid / cancelled".

Flow: family clicks Pay -> server asks Stripe for a checkout page -> family pays on Stripe's page ->
Stripe sends them back AND phones the webhook -> the SERVER (not the browser) marks the account Pro.

## Phase 0: Decide the Stripe account
- Check the account list (top-left name -> dropdown). Do NOT reuse an account that another platform manages (a "connected account", for example a platform that pays the person for jobs, or a newsletter tool such as beehiiv that manages Stripe for them). Create a NEW standalone account for the app (top-left dropdown -> Create). Stripe may reuse the person's identity details and logo from other accounts; that is normal and not a problem.
- The account must be LIVE (verified) to take real money. Home page: no "Activate your account" or "Restricted" banner.
- Bank account: Settings -> Linked accounts and payouts -> Linked accounts. Confirm the right bank is the default. Payout schedule "Automatic" is fine.

## Phase 1: Product and prices
1. Product catalog -> Create product. Name it generically (e.g. "Premium License"). Skip description/image.
2. Pricing: **Recurring**, amount, USD, billing period Monthly. Save.
3. On the product page, the **+** next to Pricing -> **Recurring**, Yearly, amount. Save.
4. Both prices live under ONE product. "Default" on the first price does not matter: the app always names the exact price.
5. Get each price ID: click the price -> top right shows `price_...` -> clipboard icon. Person pastes it into chat (safe). Record both IDs.
6. Ask first: auto-renew or one-time? Optional idea: let the buyer choose with a checkbox by making a SECOND yearly one-time price (mode 'payment') and choosing between the two in the app.
7. If the app shows prices on screen, update that text to match. Compute any "Save X%" from the real numbers: (12 x monthly - yearly) / (12 x monthly).

## Phase 2: Restricted key (the "filing cabinet key")
Stripe: Developers (bottom-left bar opens the "Workbench" panel) or the link https://dashboard.stripe.com/apikeys -> **Create a secret key**.
1. "Building your own integration" -> Continue.
2. Permissions: **Start with a template** -> tick **Recurring subscriptions and billing** (and **One-time payments** if a one-time plan is possible). Do NOT tick Full access, View-only, Send payouts, Terminal. -> Continue.
3. Name it (for example "Checkout management"; avoid the word key in the name if the person prefers) and a note ("Used by the app on <host>") -> Create key.
4. The key (`rk_live_...`) may only be shown once. The person copies it straight into the host settings (Phase 4) and never pastes it in chat or files. If lost: delete it and make a new one.
The code only needs this key plus the price IDs. The "publishable key" (`pk_live_...`) is NOT used with Stripe-hosted Checkout.

## Phase 3: Code (the assistant does this)
Copy the files in `templates/` into the app (adjust names): `api/create-checkout-session.ts`, `api/verify-checkout-session.ts`, `api/stripe-webhook.ts`, `api/lib/subscriptionAccess.ts`, and the route order in `templates/server-routes.md`. Install `stripe` and `firebase-admin`.
- The client calls `/api/create-checkout-session` with the user id, email, name and plan, then redirects to the returned URL. On return (`?stripe_session_id=...`) it calls `/api/verify-checkout-session`; the server checks with Stripe and writes the access to the database. Never let the browser decide the person paid.
- Remove any fake "pay" buttons that unlock without payment.
- Database access from the server (Firebase): the host's service account needs the role **Cloud Datastore User** in the Firebase project (IAM -> Grant access, or check that the row already exists). Usually the "Default compute service account" of the host project, named like `<project number>-compute@developer.gserviceaccount.com`.
- Build must pass; test the webhook with signed fake events (see the test script idea: Stripe's `webhooks.generateTestHeaderString`): bad signature -> 400, irrelevant event -> 200, paid event with no database -> 500 so Stripe retries.
- Tighten database rules AFTER the server path is verified: users must not be able to write `isPaid`, `accountTier`, `subscription*`, `stripe*` on their own record.

## Phase 4: Host settings (Google Cloud Run example)
Service page -> **Containers** tab -> Environment variables. Add or replace (names exact):
- `STRIPE_SECRET_KEY` = the restricted key
- `STRIPE_PRICE_ID_MONTHLY` = monthly price ID
- `STRIPE_PRICE_ID_ANNUAL` = yearly price ID
- `STRIPE_WEBHOOK_SECRET` = from Phase 5
Then the blue **Redeploy** button (top right). Wait ~1 minute; Revision History shows a new revision with a green check.
Pitfalls seen: (a) the key and the price IDs must come from the SAME Stripe account and the SAME mode (live vs test), otherwise checkout fails with a confusing error; (b) deleting a row shifts the rows up, so check every Name/Value pair after editing (screenshot shows the first characters of each value; check `price_1UPSC...` is in the MONTHLY row etc.); (c) the person's screenshots show the first characters of values: harmless, but scroll them out of view when possible; (d) later automatic deploys from Git keep the variables.

## Phase 5: Webhook
Stripe: **Developers** (bottom-left) -> **Webhooks** tab -> **Add destination**.
1. Events from **Your account**; payload style **Snapshot**; keep the API version.
2. Events (use the search box and tick exactly these 4, then check the "Selected events" tab shows 4): `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Destination type **Webhook endpoint** -> Continue.
4. Endpoint URL: `https://<your-live-address>/api/stripe-webhook`. Name it ("Unlock paid accounts"). Create destination.
5. Open the destination, click the **eye icon** next to **Signing secret** (`whsec_...`), copy, paste into the host variable `STRIPE_WEBHOOK_SECRET`. NEVER click **Roll secret** (that retires the secret). Redeploy.
6. If the live address ever changes, edit the Endpoint URL in Stripe; no new secret needed. A custom domain does not change this: the original host address keeps working.

## Phase 6: Test with real money
Your own account may be "always Pro" (a free-Pro email list), so it never sees the paywall. Use a second test account with a plus address (`name+test@gmail.com`).
- If the app shows the paywall only after a free-trial limit, set the test user's counter in the database (Firebase console -> Firestore -> users -> that user -> `searchCount`) instead of burning real usage.
- Buy the cheapest plan with a real card. Check: returns to the app, account is Pro, Stripe Customers/Payments show it, the user record has `isPaid`, `subscriptionPlan`, `stripeSubscriptionId`.
- Cancel at period end: account stays Pro until the end date. Cancel immediately: goes back to free the same day. Past_due (failed card) keeps access while Stripe retries.
- A refund usually does not return Stripe's processing fee (best understanding; about 3% + 30 cents in the US).

## Phase 6b: Let families find the upgrade and manage it (built after the first launch)
Do not make the payment screen reachable only after the free trial runs out. Build (templates in `templates/app/` and `templates/api/create-portal-session.ts`):
- An **Upgrade** button in the top menu (and phone bottom bar) for people who have not upgraded; a "N trial uses left / See plans" banner when the trial is nearly used; a plans card on the help/start page; a link `?upgrade=1` that opens the payment screen after sign-in (store the request in sessionStorage so it survives the sign-in step; useful for emails and for testing).
- A **My Plan** page: plan name, member-since date, and a **Manage subscription** button that opens Stripe's customer portal. The server route checks the person's sign-in token (Firebase `verifyIdToken`) and reads their `stripeCustomerId`, so people can only open their own billing page. Families activated before the webhook existed have no customer id: show a friendly "ask us" message.
- Switch the portal on in Stripe: gear icon (top right) -> Billing -> Customer portal. A "Default" configuration with an ID starting `bpc_` should exist; confirm **Cancel subscriptions** is on and set to **Cancel at end of billing period** (the family keeps access until the paid time ends). Nothing needs saving if nothing was changed. Do not click "Activate link".
- Keep prices in ONE file (`plans.ts`) and compute any "Save X%" from it.
- Payment screen: add a plain "You are purchasing: <product name> · plan · price · renews automatically until you cancel" box, and make the words editable in an admin page (`paywallText.ts` + `AdminPaywallEditor.tsx`, saved in a `settings/paywall` database document: signed-in users may read, only the admin may write; empty boxes fall back to the original words; prices are never editable because they must match Stripe).

## Phase 6c: Free trial and fake-account lessons (decide BEFORE launch)
- Enforce the trial on the SERVER. A trial counted only in the browser, or in a database record the user can edit, can be reset by anyone.
- Email/password signups accept made-up addresses unless email verification is REQUIRED. Verification emails are often sent but not enforced: check.
- Ideas, strongest value first: server-kept trial count; require verified email; treat Gmail dots and +tags as one address (add an exception for the owner's own +test account); a global daily cap on free uses (a hard ceiling on cost); block disposable-email domains; "Continue with Google"; soft per-IP signup limit; partner codes. Usually NOT worth it: SMS verification, card-required trials (auto-charge rules), device marking, removing PDF download from the trial.
- Start a time-limited trial at the FIRST USE, not at signup. After the trial, keep the person's saved work readable and exportable.
- State the rules plainly on the signup/payment screens ("one free trial per person").

## Phase 7: Still to do after launch
- (Done in Phase 6b) Manage subscription button and portal.
- Tighten database rules (see Phase 3): this also closes the 'edit your own trial counter' hole.
- Coupon/promo codes, usage limits, and a spending cap on any paid AI service the app calls.

## Things NOT to use
- The old Firebase "Run Payments with Stripe" extension: shuts down 2027-03-31.
- A test key (`sk_test_`) with live price IDs, or the reverse.
- Any browser-side code that writes "paid" to the database without a server-side check.
