import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    // packages/chrono-ui — общие для player/editor-web read-only компоненты
    // доски Хронолинии (Фаза 7). Это НЕ отдельный npm-пакет, потребляемый
    // через file:-зависимость (второй хрупкий symlink поверх уже хрупкого
    // @kiosk/shared) — alias на СОБРАННЫЙ вывод (dist).
    // У chrono-ui СВОЙ node_modules (нужен для его собственных тестов и для
    // резолвинга bare-специфаеров из физически внешнего каталога) — но это
    // значит, что react/@kiosk/shared из chrono-ui/node_modules и из
    // node_modules player'а - РАЗНЫЕ файлы на диске. preserveSymlinks не
    // резолвит их к одному realpath, поэтому Rollup без явного alias'а
    // склеил бы в бандл ДВЕ копии react (сломанные хуки) и zod. Явно
    // указываем chrono-ui брать react/@kiosk/shared из node_modules player'а.
    alias: {
      '@kiosk/chrono-ui': path.resolve(__dirname, '../chrono-ui/dist'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@kiosk/shared': path.resolve(__dirname, 'node_modules/@kiosk/shared'),
    },
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
