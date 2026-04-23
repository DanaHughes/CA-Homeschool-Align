
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const port = parseInt(process.env.PORT || '8080');
  
  return {
    plugins: [react()],
    define: {
      // Gemini key is consumed via `process.env.API_KEY` in services/geminiService.ts.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.VITE_ACCESS_CODE': JSON.stringify(env.VITE_ACCESS_CODE || 'TEACH2024')
      // Firebase config is read directly via `import.meta.env.VITE_FIREBASE_*`
      // in firebase.ts — no define mapping needed.
    },
    server: {
      host: '0.0.0.0',
      port: port,
    },
    preview: {
      host: '0.0.0.0',
      port: port,
      allowedHosts: true
    },
    build: {
      outDir: 'dist'
    }
  };
});
