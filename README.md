<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1f-vTVeT67YJ-0QmUv_U-D5OKJnPLlfC1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in the required values:
   - `VITE_FIREBASE_API_KEY` — Web API key from Firebase Console (Project Settings → General → Your apps → SDK setup). Without this you will see `Firebase: Error (auth/api-key-not-valid)` on the sign-in screen.
   - `API_KEY` — Your Gemini API key (for AI standard matching).
   - The other `VITE_FIREBASE_*` values already default to this project; override only if you're pointing at a different Firebase project.
3. Run the app:
   `npm run dev`

### Deploying

When building for Firebase Hosting, make sure `VITE_FIREBASE_API_KEY` (and the other env vars) are present at build time — either via `.env.production` or by exporting them in your shell before running `npm run build`. They are baked into the bundle during `vite build` and cannot be changed after deploy without rebuilding.
