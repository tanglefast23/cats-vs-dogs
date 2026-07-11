import { defineConfig } from 'vite';

/**
 * Content Security Policy for the game. The dev server needs the Vite HMR
 * websocket; the production bundle (web and packaged desktop) stays local-only.
 * Injected here instead of hardcoded in index.html so production never carries
 * the dev allowances.
 */
function cspContent(isDev) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // 'unsafe-inline' covers the style="" attributes the renderer writes; no <style> injection.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? ' ws://127.0.0.1:4173 http://127.0.0.1:4173' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

function cspPlugin() {
  return {
    name: 'cvd-inject-csp',
    transformIndexHtml(html, ctx) {
      const isDev = Boolean(ctx.server);
      return {
        html,
        tags: [{
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: cspContent(isDev) },
          injectTo: 'head-prepend',
        }],
      };
    },
  };
}

export default defineConfig({
  // Relative asset paths so the same bundle works on Vercel, from disk, and via app:// in Electron.
  base: './',
  plugins: [cspPlugin()],
  build: {
    outDir: 'dist',
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
