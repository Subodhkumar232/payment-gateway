import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');
const viewsDir = path.join(baseDir, 'src/views');
const outDir = path.join(baseDir, 'public/js');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('[build-jsx] Compiling React JSX components...');

// 1. Client Browser Bundle (IIFE)
const clientOut = path.join(outDir, 'admin.bundle.js');
esbuild.buildSync({
  entryPoints: [path.join(viewsDir, 'index.jsx')],
  bundle: true,
  outfile: clientOut,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

console.log(`[build-jsx] Client bundle written: ${clientOut} (${fs.statSync(clientOut).size} bytes)`);

// 2. Server-Side SSR Dashboard Bundle (CommonJS)
const ssrOut = path.join(outDir, 'admin.ssr.cjs');
esbuild.buildSync({
  entryPoints: [path.join(viewsDir, 'App.jsx')],
  bundle: true,
  outfile: ssrOut,
  format: 'cjs',
  platform: 'node',
  target: ['node18'],
  external: ['react', 'react-dom', 'react-dom/server'],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

console.log(`[build-jsx] Dashboard SSR bundle written: ${ssrOut} (${fs.statSync(ssrOut).size} bytes)`);

// 3. Server-Side SSR Login Bundle (CommonJS)
const ssrLoginOut = path.join(outDir, 'login.ssr.cjs');
esbuild.buildSync({
  entryPoints: [path.join(viewsDir, 'LoginPage.jsx')],
  bundle: true,
  outfile: ssrLoginOut,
  format: 'cjs',
  platform: 'node',
  target: ['node18'],
  external: ['react', 'react-dom', 'react-dom/server'],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

console.log(`[build-jsx] Login SSR bundle written: ${ssrLoginOut} (${fs.statSync(ssrLoginOut).size} bytes)`);
console.log('[build-jsx] Build completed successfully.');
