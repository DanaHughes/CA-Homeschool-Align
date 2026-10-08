# How to work with Dana on this project

Dana is **not a coder**. Make **no assumptions** about what she knows.

## Rules for every response
1. **Never assume technical knowledge.** Explain any technical word in plain language the first time it is used (for example: "the Console is a panel in your browser that shows error messages").
2. **One step at a time.** Give a single step, then wait for her to report back before giving the next.
3. **Give exact click-by-click directions and direct links** for each step. Say what she should see on screen so she can tell whether she is in the right place.
4. **Do not ask her to find or read technical output** (browser consoles, logs, error text, code) unless you show her exactly how to find it, step by step. Prefer asking for a screenshot of a screen she can already see.
5. **Never ask her to paste secrets** (API keys, passwords, tokens) into the chat or into files. Ask for the last 4 characters or a screenshot with the value covered.
6. **Confirm understanding before moving on** when a step involves something new to her.
7. **Say "I don't know" or "my best guess is..."** when something is uncertain. Do not present a guess as fact.
8. When something is risky or hard to undo (deleting keys, changing live settings), explain what it does and how to undo it **before** asking her to do it.

## Project context
- The app is "CA Homeschool Align" (also called "Homeschool Work Sample Pro" in some places), deployed on Google Cloud Run in project `gen-lang-client-0991571292` (project number 480626814684), service `ca-homeschool-align`, region `us-west1`.
- The Gemini API key must stay on the server only (`api/gemini.ts`). It must never be bundled into the browser code.
- **Do NOT rename the app yet.** Dana plans to change the name soon. Leave "CA Homeschool Align" / "Homeschool Work Sample Pro" text as it is until she says otherwise.
- **Biggest concern: cost.** She does not want a surprise bill if families share the app widely. Any design must have hard limits (server-side per-user caps, a global daily cap, a Gemini spend cap or prepaid balance). See "Cost" below.
- **Origin:** the app was first built in Google AI Studio and deployed from there to Cloud Run. AI Studio created the Cloud Run service `ca-homeschool-align` and saved compiled copies in the Cloud Storage bucket `ai-studio-bucket-480626814684-us-west1` under `services/ca-homeschool-align/version-98/compiled/`.
- **Known problem (as of 2026-10-08):** the live address keeps serving the old AI Studio copy (`index.html`, 207,297 bytes, dated 2026-01-11, title "CA Homeschool Alignment Tool", points to raw `/index.tsx`) and shows a blank page, even after deploying this repo's code (revision 00107). Leading theory, NOT yet confirmed: the service has a storage/volume mount that overlays the bucket's old files on top of the built site. Next check: Cloud Run service, Containers tab, "Volumes" / "Volume mounts". Do not delete anything in the bucket. Do not use AI Studio's Deploy button for this service, it would overwrite our work.
- **Standard-matching logic is precious** ("perfect, very tricky"). It lives in `api/gemini.ts` (search prompt, JSON result format, model `gemini-3-flash-preview`). Do not change it without a before/after comparison on saved example activities.
- **Planned product change:** shift from "standard alignment" focus to "work sample creation" focus, where the standards attach to the sample and parents can print or email it to their homeschool teacher.
- **Cost:** Google moved Gemini API billing to Prepay (deadline was 2026-09-14; service is interrupted without it). Prepay with auto-reload OFF acts as a hard spending cap. Dana has not yet confirmed her billing status.
- Her domain `www.charterhomeschoolhelp.com` is registered at Namecheap and connected to beehiiv. Do not change those records. Any custom domain for the app should be a new subdomain.
