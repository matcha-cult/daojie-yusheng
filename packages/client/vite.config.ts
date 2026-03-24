import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const proxyTarget = env.VITE_DEV_PROXY_TARGET?.trim();

  return {
    resolve: {
      alias: {
        '@mud/shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          gm: path.resolve(__dirname, 'gm.html'),
        },
      },
    },
    server: proxyTarget
      ? {
          proxy: {
            '/auth': proxyTarget,
            '/account': proxyTarget,
            '/gm/': proxyTarget,
            '/socket.io': {
              target: proxyTarget,
              ws: true,
            },
          },
        }
      : undefined,
  };
});
