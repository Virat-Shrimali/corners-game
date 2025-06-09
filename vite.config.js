import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.', // Ensure root is set to project directory
  build: {
    rollupOptions: {
      input: 'index.html', // Confirm entry point
    },
  },
});