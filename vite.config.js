import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    target: 'es2019',
    rollupOptions: {
      input: {
        main: r('./index.html'),
        admin: r('./admin.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
  },
});
