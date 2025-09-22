import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'url';
import environment from 'vite-plugin-environment';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [environment('all', { prefix: 'CANISTER_' }), environment('all', { prefix: 'DFX_' })],
  envDir: '../',
  define: {
    'process.env': process.env
  },
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
});
