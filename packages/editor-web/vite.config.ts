import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @kiosk/shared подключён как file:-зависимость и лежит в node_modules
  // как symlink; без этого Vite/Rollup резолвят его в реальный путь вне
  // node_modules и @rollup/plugin-commonjs не видит именованные экспорты
  // при продакшен-сборке (см. подробный разбор в Хронолайнер_план_реализации.md,
  // Фаза 3, коммит 09b9bff — баг найден и починён именно в packages/player).
  resolve: {
    preserveSymlinks: true,
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
