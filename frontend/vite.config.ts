import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');

  const processEnv = {};
  for (const key in env) {
    if (key.startsWith('CANISTER_') || key.startsWith('DFX_') || key.startsWith('VITE_')) {
      processEnv[`process.env.${key}`] = JSON.stringify(env[key]);
    }
  }

  return {
    plugins: [
      react(),
    ],
    base: '/',
    define: processEnv,
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
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
          replacement: path.resolve(__dirname, './src')
        }
      ]
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4943',
          changeOrigin: true
        }
      },
      host: '127.0.0.1'
    }
  };
});
