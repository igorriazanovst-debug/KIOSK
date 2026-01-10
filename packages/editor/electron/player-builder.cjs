/**
 * Player Builder v2 - Улучшенная версия с надёжной проверкой зависимостей
 * 
 * Этот скрипт:
 * 1. Копирует текущий проект в player/electron/project.json
 * 2. Проверяет и принудительно устанавливает зависимости Player
 * 3. Запускает сборку Player
 * 4. Возвращает путь к готовому установщику
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class PlayerBuilder {
  constructor(options = {}) {
    this.projectData = options.projectData;
    this.onProgress = options.onProgress || (() => {});
    this.onLog = options.onLog || console.log;
    this.playerPath = options.playerPath || path.join(__dirname, '../../player');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    this.onLog(formattedMessage, type);
  }

  async build() {
    try {
      this.log('🚀 Начинаем сборку Player...', 'info');
      this.onProgress(0, 'Подготовка...');

      // Шаг 1: Проверка существования папки Player
      if (!fs.existsSync(this.playerPath)) {
        throw new Error(`Player папка не найдена: ${this.playerPath}`);
      }
      this.log(`✓ Player папка найдена: ${this.playerPath}`, 'success');
      this.onProgress(5, 'Проверка папки Player...');

      // Шаг 2: Копирование проекта
      await this.copyProjectToPlayer();
      this.onProgress(10, 'Проект скопирован...');

      // Шаг 3: ПРИНУДИТЕЛЬНАЯ установка зависимостей
      await this.ensureDependencies();
      this.onProgress(40, 'Зависимости установлены...');

      // Шаг 4: Сборка TypeScript и Vite
      await this.buildPlayer();
      this.onProgress(70, 'Сборка завершена...');

      // Шаг 5: Создание установщика Electron
      await this.buildInstaller();
      this.onProgress(95, 'Установщик создан...');

      // Шаг 6: Поиск готового установщика
      const installerPath = await this.findInstaller();
      this.onProgress(100, 'Готово!');

      this.log('✅ Сборка успешно завершена!', 'success');
      this.log(`📦 Установщик: ${installerPath}`, 'success');

      return {
        success: true,
        installerPath: installerPath,
        size: this.getFileSize(installerPath)
      };

    } catch (error) {
      this.log(`❌ Ошибка: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async copyProjectToPlayer() {
    this.log('📋 Копирование проекта в Player...', 'info');
    
    const projectPath = path.join(this.playerPath, 'electron', 'project.json');
    const projectDir = path.dirname(projectPath);

    // Создаём директорию если не существует
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Сохраняем проект
    fs.writeFileSync(
      projectPath,
      JSON.stringify(this.projectData, null, 2),
      'utf8'
    );

    this.log(`✓ Проект сохранён: ${projectPath}`, 'success');
  }

  async ensureDependencies() {
    this.log('🔍 Проверка зависимостей Player...', 'info');
    
    const nodeModulesPath = path.join(this.playerPath, 'node_modules');
    const packageJsonPath = path.join(this.playerPath, 'package.json');

    // Проверяем существование package.json
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json не найден в Player папке!');
    }

    // ВСЕГДА устанавливаем зависимости заново для надёжности
    this.log('📦 Устанавливаем зависимости Player (это может занять несколько минут)...', 'info');
    
    try {
      // Удаляем старые node_modules если есть
      if (fs.existsSync(nodeModulesPath)) {
        this.log('🗑️ Удаляем старые node_modules...', 'warning');
        await this.removeDirectory(nodeModulesPath);
      }

      // Устанавливаем зависимости
      await this.runCommand('npm', ['install', '--legacy-peer-deps'], this.playerPath);
      this.log('✓ Основные зависимости установлены', 'success');

      // Устанавливаем инструменты для сборки
      this.log('📦 Устанавливаем инструменты для сборки...', 'info');
      await this.runCommand('npm', ['install', '7zip-bin', 'app-builder-bin', '--save-dev', '--legacy-peer-deps'], this.playerPath);
      this.log('✓ Инструменты для сборки установлены', 'success');

    } catch (error) {
      this.log('⚠️ Ошибка установки зависимостей, пробуем альтернативный метод...', 'warning');
      
      // Альтернативный метод без удаления node_modules
      await this.runCommand('npm', ['install', '--legacy-peer-deps', '--force'], this.playerPath);
      await this.runCommand('npm', ['install', '7zip-bin', 'app-builder-bin', '--save-dev', '--legacy-peer-deps', '--force'], this.playerPath);
    }
  }

  async removeDirectory(dirPath) {
    return new Promise((resolve, reject) => {
      // Используем системную команду для удаления (быстрее чем fs.rm)
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'rmdir' : 'rm';
      const args = isWindows ? ['/s', '/q', dirPath] : ['-rf', dirPath];

      const proc = spawn(command, args, { shell: true });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to remove directory: ${dirPath}`));
        }
      });

      proc.on('error', reject);
    });
  }

  async buildPlayer() {
    this.log('🔨 Сборка Player (TypeScript + Vite)...', 'info');
    await this.runCommand('npm', ['run', 'build'], this.playerPath);
    this.log('✓ Сборка Player завершена', 'success');
  }

  async buildInstaller() {
    this.log('📦 Создание установщика Windows...', 'info');
    await this.runCommand('npm', ['run', 'electron:build:win'], this.playerPath);
    this.log('✓ Установщик создан', 'success');
  }

  async findInstaller() {
    const distPath = path.join(this.playerPath, 'dist-electron');
    
    if (!fs.existsSync(distPath)) {
      throw new Error('Папка dist-electron не найдена!');
    }

    const files = fs.readdirSync(distPath);
    
    const installerFile = files.find(file => 
      file.endsWith('.exe') && file.includes('Setup')
    );

    if (!installerFile) {
      throw new Error('Установщик не найден в dist-electron/');
    }

    return path.join(distPath, installerFile);
  }

  getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    return `${sizeMB} MB`;
  }

  runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
      this.log(`▶ Выполняется: ${command} ${args.join(' ')}`, 'info');

      const process = spawn(command, args, {
        cwd: cwd,
        shell: true,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Логируем только важные строки для уменьшения шума
        const lines = text.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed && (
            trimmed.includes('✓') || 
            trimmed.includes('✔') || 
            trimmed.includes('built') ||
            trimmed.includes('packages') ||
            trimmed.includes('added') ||
            trimmed.includes('success')
          )) {
            this.log(trimmed, 'info');
          }
        });
      });

      process.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        
        // Игнорируем обычные npm warnings
        if (!text.toLowerCase().includes('warn') && 
            !text.includes('deprecated') &&
            !text.includes('EBADENGINE')) {
          this.log(text.trim(), 'warning');
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}\n${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }
}

module.exports = PlayerBuilder;
