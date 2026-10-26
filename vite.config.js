import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    sourcemap: false,
    rolldownOptions: {
      output: { entryFileNames: 'assets/[hash].js', chunkFileNames: 'assets/[hash].js', assetFileNames: 'assets/[hash][extname]' },
      input: {
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
  },
  server: {
    fs: {
      deny: ['.env', '.env.*', '**/*.{crt,pem}', '**/.git/**', '**/data/**', '**/server/**', '**/*.sqlite*', '**/*.db*'],
    },
  },
});
