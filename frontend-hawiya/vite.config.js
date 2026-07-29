import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

const OCR = { target: 'http://127.0.0.1:5000', changeOrigin: true };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const processEnv = {};
  for (const key in env) {
    if (key.startsWith('CANISTER_') || key.startsWith('DFX_') || key.startsWith('VITE_')) {
      processEnv[`process.env.${key}`] = JSON.stringify(env[key]);
    }
  }
  return {
    plugins: [react()],
    base: '/',
    define: processEnv,
    resolve: {
      alias: [
        { find: 'declarations', replacement: fileURLToPath(new URL('../src/declarations', import.meta.url)) },
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }
      ]
    },
    server: {
      host: '127.0.0.1',
      allowedHosts: true, // dev-only: accept cloudflared quick-tunnel hostnames
      proxy: {
        '/api': { target: 'http://127.0.0.1:4943', changeOrigin: true },
        // EVERY OCR-server endpoint the app calls must be listed here — a
        // missing entry 404s at the dev server and reads as a silent feature
        // failure on the phone (the strip scan + holo check shipped broken
        // exactly this way, 2026-07-29).
        '/ocr': OCR, '/egyptian-id': OCR, '/egyptian-id-back': OCR,
        '/passport': OCR, '/verify-face': OCR, '/detect-id-card': OCR,
        '/face': OCR, '/health': OCR, '/detect-fields': OCR,
        '/barcode-strip': OCR, '/holo-check': OCR, '/session-step': OCR
      }
    }
  };
});
