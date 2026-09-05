import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  // @kiosk/shared - тот же workaround, что editor-web/player (см. их
  // vite.config.ts): file:-зависимость лежит в node_modules как symlink,
  // без preserveSymlinks+alias Rollup резолвит её вне node_modules и теряет
  // именованные экспорты в продакшен-сборке.
  resolve: {
    preserveSymlinks: true,
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@kiosk/shared': path.resolve(__dirname, 'node_modules/@kiosk/shared'),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      // Мульти-страничная сборка: index.html - студенческий клиент (T5-074),
      // admin.html - панель администратора (Эпик 10, T5-090/091). Разные
      // аудитории/уровень доступа - разные HTML+JS входы одного бандла, не
      // общий JS с client-side роутингом (не тянуть код админки туда, где
      // она не нужна, и наоборот).
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin.html'),
      },
    },
  },
});
