import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@store': path.resolve(__dirname, './src/store'),
      '@api': path.resolve(__dirname, './src/api'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@services': path.resolve(__dirname, './src/services'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      /* Forward all /api/v1/* requests to the Express backend.
         changeOrigin prevents the Host header mismatch that causes CORS errors. */
      '/api/v1': {
        target:       'https://arogyaaai.onrender.com',
        changeOrigin: true,
        secure:       false,
        configure: (proxy) => {
          proxy.on('error', (err) => console.error('[proxy]', err.message));
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: 'hidden',   // maps generated but not exposed in browser (security)
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          animation: ['framer-motion'],
          ui: ['lucide-react', 'react-icons'],
        },
      },
    },
  },
});
