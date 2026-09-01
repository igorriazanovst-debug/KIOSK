import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function removeModuleType(): Plugin {
  return {
    name: 'remove-module-type',
    transformIndexHtml(html: string) {
      return html
        .replace(/<script type="module" crossorigin/g, '<script defer')
        .replace(/<script type="module"/g, '<script defer')
        .replace(/ crossorigin/g, '');
    }
  };
}

export default defineConfig({
  plugins: [react(), removeModuleType()],
  base: './',
  // @kiosk/shared подключён как локальная file:-зависимость и лежит в
  // node_modules/@kiosk/shared как symlink. По умолчанию Vite/Rollup
  // резолвят symlink в реальный путь (packages/shared/dist/...), который
  // не содержит "node_modules" — из-за этого @rollup/plugin-commonjs
  // (через build.commonjsOptions.include) никогда не подхватывает файл и
  // не делает CJS->ESM interop, поэтому именованные экспорты не видны
  // статическому анализу, хотя require() их прекрасно находит в рантайме.
  // preserveSymlinks сохраняет путь как node_modules/@kiosk/shared/...,
  // и commonjs-плагин обрабатывает пакет как обычную CJS-зависимость.
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome110',
  },
  optimizeDeps: {
    include: ['@kiosk/shared'],
  },
  server: {
    port: 5173,
  },
});
