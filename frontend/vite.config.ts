import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1024, // 1MB warning limit
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // MUI components in one chunk
          'mui-core': ['@mui/material', '@mui/icons-material'],
          // MUI X components (heavy date pickers, data grid)
          'mui-x': ['@mui/x-data-grid', '@mui/x-date-pickers'],
          // React ecosystem
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching and state management
          'data-vendor': ['@tanstack/react-query', 'axios'],
          // Form handling
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Charts (heavy)
          'charts': ['recharts'],
        },
      },
    },
    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      '@mui/material',
      '@mui/icons-material',
      '@mui/x-data-grid',
      '@mui/x-date-pickers',
      'recharts',
    ],
  },
});
