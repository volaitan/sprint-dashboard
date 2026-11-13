/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH lets the same build run at the domain root or under /sprint-dashboard/ on GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
