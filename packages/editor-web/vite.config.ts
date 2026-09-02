import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // @kiosk/shared подключён как file:-зависимость и лежит в node_modules
  // как symlink; без этого Vite/Rollup резолвят его в реальный путь вне
  // node_modules и @rollup/plugin-commonjs не видит именованные экспорты
  // при продакшен-сборке (см. подробный разбор в Хронолайнер_план_реализации.md,
  // Фаза 3, коммит 09b9bff — баг найден и починён именно в packages/player).
  resolve: {
    preserveSymlinks: true,
    // packages/chrono-ui — общие для player/editor-web read-only компоненты
    // доски Хронолинии (Фаза 7). Это НЕ отдельный npm-пакет, потребляемый
    // через file:-зависимость (второй хрупкий symlink поверх уже хрупкого
    // @kiosk/shared) — alias на СОБРАННЫЙ вывод (dist).
    // У chrono-ui СВОЙ node_modules (нужен для его собственных тестов и для
    // резолвинга bare-специфаеров из физически внешнего каталога) — но это
    // значит, что react/@kiosk/shared из chrono-ui/node_modules и из
    // node_modules editor-web - РАЗНЫЕ файлы на диске. preserveSymlinks не
    // резолвит их к одному realpath, поэтому Rollup без явного alias'а
    // склеил бы в бандл ДВЕ копии react (сломанные хуки) и zod. Явно
    // указываем chrono-ui брать react/@kiosk/shared из node_modules editor-web.
    alias: {
      '@kiosk/chrono-ui': path.resolve(__dirname, '../chrono-ui/dist'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@kiosk/shared': path.resolve(__dirname, 'node_modules/@kiosk/shared'),
    },
  },
  build: {
    sourcemap: true,  // Включаем source maps для отладки
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          konva: ['react-konva', 'konva']
        }
      }
    }
  }
});
