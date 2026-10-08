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
- Her domain `www.charterhomeschoolhelp.com` is registered at Namecheap and connected to beehiiv. Do not change those records. Any custom domain for the app should be a new subdomain.
