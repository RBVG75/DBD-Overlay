import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  // Character portraits and icons live outside `src`, so point Vite's static
  // asset folder at them: `images/killers/x.webp` is served as `/killers/x.webp`
  // in dev and copied to `dist/` on build.
  publicDir: '../images',
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
