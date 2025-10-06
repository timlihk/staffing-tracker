import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2048, // suppress warning triggered by large vendor bundle
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('@mui/x-data-grid')) {
              return 'mui-datagrid';
            }
            if (id.includes('@mui/x-date-pickers')) {
              return 'mui-date';
            }
            if (id.includes('@mui/icons-material')) {
              return 'mui-icons';
            }
            if (id.includes('@mui/') || id.includes('@emotion/')) {
              return 'mui-core';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('zod')) {
              return 'validation';
            }
            if (id.includes('react-hook-form') || id.includes('@hookform')) {
              return 'forms';
            }
            if (id.includes('axios')) {
              return 'http';
            }
          }
        },
      },
    },
  },
})
