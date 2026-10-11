import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

// Stripe's webhook needs the raw, untouched body to prove the message is really from Stripe,
// so this route is registered BEFORE the JSON reader below.
app.post('/api/stripe-webhook', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res) => {
  const handler = (await import('./api/stripe-webhook.js')).default;
  return handler(req, res);
});

// Large limit so photo uploads (sent as base64) fit in one request.
app.use(express.json({ limit: '15mb' }));

app.post('/api/create-checkout-session', async (req, res) => {
  const handler = (await import('./api/create-checkout-session.js')).default;
  return handler(req, res);
});

app.post('/api/verify-checkout-session', async (req, res) => {
  const handler = (await import('./api/verify-checkout-session.js')).default;
  return handler(req, res);
});

app.post('/api/create-portal-session', async (req, res) => {
  const handler = (await import('./api/create-portal-session.js')).default;
  return handler(req, res);
});

app.post('/api/gemini', async (req, res) => {
  const handler = (await import('./api/gemini.js')).default;
  return handler(req, res);
});

app.post('/api/send-email', async (req, res) => {
  const handler = (await import('./api/send-email.js')).default;
  return handler(req, res);
});

app.use(express.static(join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
