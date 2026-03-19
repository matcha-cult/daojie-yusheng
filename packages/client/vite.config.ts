import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mud/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
