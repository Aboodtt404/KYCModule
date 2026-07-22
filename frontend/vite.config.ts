/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');

  const processEnv: Record<string, string> = {};
  for (const key in env) {
    if (key.startsWith('CANISTER_') || key.startsWith('DFX_') || key.startsWith('VITE_')) {
      processEnv[`process.env.${key}`] = JSON.stringify(env[key]);
    }
  }

  const isProd = mode === 'production';

  return {
    plugins: [react()],
    base: '/',
    define: processEnv,
    // Strip console.log and console.warn from production builds
    // console.error is kept so real errors remain visible in prod
    esbuild: isProd ? { drop: ['debugger'], pure: ['console.log', 'console.warn', 'console.debug'] } : {},
    optimizeDeps: {
      esbuildOptions: {
        define: { global: 'globalThis' }
      }
    },
    resolve: {
      alias: [
        {
          find: 'declarations',
          replacement: fileURLToPath(new URL('../src/declarations', import.meta.url))
        },
        {
          find: '@',
          replacement: fileURLToPath(new URL('./src', import.meta.url))
        }
      ]
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4943',
          changeOrigin: true
        },
        '/ocr': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true
        },
        '/egyptian-id': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true
        },
        '/passport': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true
        },
        '/verify-face': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true
        },
        '/detect-id-card': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true
        },
        '/face': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true
        }
      },
      host: '127.0.0.1'
    }
  };
});
