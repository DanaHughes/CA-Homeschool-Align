# Express server routes (server.ts)

The webhook route MUST be registered BEFORE `app.use(express.json(...))`.
Stripe signs the exact raw bytes it sends; if the JSON reader runs first, the body is
changed and every signature check fails.

```ts
// Stripe's webhook needs the raw, untouched body to prove the message is really from Stripe,
// so this route is registered BEFORE the JSON reader below.
app.post('/api/stripe-webhook', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res) => {
  const handler = (await import('./api/stripe-webhook.js')).default;
  return handler(req, res);
});

app.use(express.json({ limit: '15mb' }));

app.post('/api/create-checkout-session', async (req, res) => {
  const handler = (await import('./api/create-checkout-session.js')).default;
  return handler(req, res);
});

app.post('/api/verify-checkout-session', async (req, res) => {
  const handler = (await import('./api/verify-checkout-session.js')).default;
  return handler(req, res);
});
```

Packages: `npm install stripe firebase-admin`
