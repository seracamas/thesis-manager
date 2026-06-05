import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['pdfjs-dist'], // Don't pre-bundle PDF.js
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-link'],
          'utils': ['date-fns', 'clsx'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    commonjsOptions: {
      ignoreTryCatch: false,
    },
  },
  server: {
    port: 5173,
    strictPort: false, // Try next available port if 5173 is taken
    open: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
