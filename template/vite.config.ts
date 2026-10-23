import { defineConfig } from 'vite';

export default defineConfig({
  // MapLibre finds its worker script beside its own module file. Pre-bundling would move the
  // module into Vite's cache and leave the worker behind, so it is served as published.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  // A local map loads in one piece: MapLibre and its worker alone are past Vite's 500 kB warning size.
  build: { chunkSizeWarningLimit: 2500 },
  // The library's server (~/Projects/reading-maps) serves the book in development. This is only for sharing:
  // `npm run build && npm run preview`, then `ngrok http <preview port>` to show someone the map for a while.
  preview: { port: 5181, allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'] },
});
