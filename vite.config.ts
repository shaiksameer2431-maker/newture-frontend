import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { Socket } from 'net';

// Probe localhost ports to find a responsive backend during dev.
const probePort = (port: number, timeout = 150) => {
  return new Promise<boolean>((resolve) => {
    const s = new Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      try { s.destroy(); } catch {}
      resolve(ok);
    };
    s.setTimeout(timeout);
    s.once('connect', () => finish(true));
    s.once('timeout', () => finish(false));
    s.once('error', () => finish(false));
    s.connect(port, '127.0.0.1');
  });
};

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredPort = Number(env.PORT || 3000);

  // If VITE_API_PROXY_TARGET is explicitly provided, use it immediately.
  if (env.VITE_API_PROXY_TARGET && env.VITE_API_PROXY_TARGET.length > 0) {
    const apiTarget = env.VITE_API_PROXY_TARGET;
    return {
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
          '@shared': path.resolve(__dirname, '../shared'),
        },
      },
      server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: false,
        watch: {
          usePolling: true,
          interval: 300,
        },
        hmr: {
          protocol: 'ws',
          host: 'localhost',
        },
        proxy: {
          '/api': {
            target: apiTarget,
            changeOrigin: true,
          },
          '/uploads': {
            target: apiTarget,
            changeOrigin: true,
          },
        },
      },
      build: {
        outDir: 'dist',
        sourcemap: true,
        chunkSizeWarningLimit: 1200,
      },
    };
  }

  // Try to detect a running backend by probing likely ports.
  const candidates = Array.from(new Set([configuredPort, 3000, 3001, 3002, 3003, 3004]));
  let livePort = configuredPort;
  for (const p of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await probePort(p)) {
      livePort = p;
      break;
    }
  }

  const apiTarget = `http://localhost:${livePort}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    server: {
      host: '0.0.0.0', // expose on localhost and network to avoid binding issues causing ERR_NETWORK_CHANGED
      port: 5173,
      strictPort: false,
      watch: {
        // Use polling on Windows for more reliable file watching across editors and network drives
        usePolling: true,
        interval: 300,
      },
      hmr: {
        // Keep HMR client stable; avoid unexpected reconnect loops
        protocol: 'ws',
        host: 'localhost',
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      chunkSizeWarningLimit: 1200,
    },
  };
});
