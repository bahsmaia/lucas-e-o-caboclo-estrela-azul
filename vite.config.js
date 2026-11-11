import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';

// Desenvolvimento: /index.react-fonte.html carrega realmente src/main.jsx.
// Publicação por build: entrega dist/index.html com o bundle React + Three.js.
// A distribuição legada index.html + app.js continua disponível sem npm.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'estrela-azul-react-build',
      apply: 'build',
      closeBundle() {
        const output = resolve('dist');
        const reactEntry = resolve(output, 'index.react-fonte.html');
        if (!existsSync(reactEntry)) {
          throw new Error('A entrada React não foi gerada pelo Vite.');
        }
        renameSync(reactEntry, resolve(output, 'index.html'));
        for (const name of ['soundtrack.js', 'favicon.png', 'favicon.ico', 'manifest.webmanifest', 'pwa-icon-192.png', 'pwa-icon-512.png']) {
          copyFileSync(resolve(name), resolve(output, name));
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: resolve('index.react-fonte.html')
    }
  }
});
