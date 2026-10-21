import { defineConfig } from 'vite';

export default defineConfig({
  // MapLibre finds its worker script beside its own module file. Pre-bundling would move the
  // module into Vite's cache and leave the worker behind, so it is served as published.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: { port: 5180 },
  // `npm run build && npm run preview`, then `ngrok http <preview port>` to show someone the map for a while.
  preview: { port: 5181, allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'] },
});
