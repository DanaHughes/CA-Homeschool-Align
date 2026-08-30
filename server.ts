import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

app.use(express.json());

app.post('/api/create-checkout-session', async (req, res) => {
  const handler = (await import('./api/create-checkout-session.js')).default;
  return handler(req, res);
});

app.post('/api/verify-checkout-session', async (req, res) => {
  const handler = (await import('./api/verify-checkout-session.js')).default;
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
