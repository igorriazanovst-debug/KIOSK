/**
 * Player Builder v3 - ФИНАЛЬНАЯ ВЕРСИЯ
 * 
 * Исправления:
 * - Автоматическое копирование 7zip-bin из глобальной установки
 * - Удаление ссылок на иконку из package.json перед сборкой
 * - Улучшенная обработка ошибок
 * - Подробное логирование
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
      this.log('🚀 Начинаем сборку Player v3...', 'info');
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

      // Шаг 3: Исправление package.json (удаление иконок)
      await this.fixPackageJson();
      this.onProgress(15, 'package.json исправлен...');

      // Шаг 4: Установка зависимостей
      await this.ensureDependencies();
      this.onProgress(50, 'Зависимости установлены...');

      // Шаг 5: Сборка TypeScript и Vite
      await this.buildPlayer();
      this.onProgress(75, 'Сборка завершена...');

      // Шаг 6: Создание установщика Electron
      await this.buildInstaller();
      this.onProgress(95, 'Установщик создан...');

      // Шаг 7: Поиск готового установщика
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

  async fixPackageJson() {
    this.log('🔧 Исправление package.json (удаление ссылок на иконку)...', 'info');
    
    const packageJsonPath = path.join(this.playerPath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json не найден!');
    }

    try {
      // Читаем package.json
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Удаляем ссылки на иконку
      if (packageJson.build && packageJson.build.win) {
        delete packageJson.build.win.icon;
        this.log('  ✓ Удалена ссылка win.icon', 'success');
      }

      if (packageJson.build && packageJson.build.nsis) {
        delete packageJson.build.nsis.installerIcon;
        delete packageJson.build.nsis.uninstallerIcon;
        this.log('  ✓ Удалены ссылки nsis.installerIcon и uninstallerIcon', 'success');
      }

      // Сохраняем исправленный package.json
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      this.log('✓ package.json исправлен', 'success');

    } catch (error) {
      this.log(`⚠️ Не удалось исправить package.json: ${error.message}`, 'warning');
      // Не критично - продолжаем
    }
  }

  async ensureDependencies() {
    this.log('🔍 Установка зависимостей Player...', 'info');
    
    const nodeModulesPath = path.join(this.playerPath, 'node_modules');

    try {
      // Проверяем node_modules
      if (!fs.existsSync(nodeModulesPath)) {
        this.log('📦 node_modules не найдены, устанавливаем...', 'info');
        await this.runCommand('npm', ['install', '--legacy-peer-deps'], this.playerPath);
      } else {
        this.log('✓ node_modules уже установлены', 'success');
      }

      // Проверяем app-builder-bin
      const appBuilderPath = path.join(nodeModulesPath, 'app-builder-bin');
      if (!fs.existsSync(appBuilderPath)) {
        this.log('📦 Устанавливаем app-builder-bin...', 'info');
        await this.runCommand('npm', ['install', 'app-builder-bin', '--save-dev', '--legacy-peer-deps'], this.playerPath);
      } else {
        this.log('✓ app-builder-bin уже установлен', 'success');
      }

      // Проверяем 7zip-bin (ОСОБАЯ ОБРАБОТКА)
      await this.ensure7zipBin();

    } catch (error) {
      throw new Error(`Ошибка установки зависимостей: ${error.message}`);
    }
  }

  async ensure7zipBin() {
    const sevenZipPath = path.join(this.playerPath, 'node_modules', '7zip-bin');
    
    if (fs.existsSync(sevenZipPath)) {
      this.log('✓ 7zip-bin уже установлен', 'success');
      return;
    }

    this.log('📦 Устанавливаем 7zip-bin (специальный метод)...', 'info');

    try {
      // Пробуем обычную установку
      await this.runCommand('npm', ['install', '7zip-bin@5.2.0', '--save-dev', '--force'], this.playerPath);
      
      if (fs.existsSync(sevenZipPath)) {
        this.log('✓ 7zip-bin установлен через npm', 'success');
        return;
      }
    } catch (error) {
      this.log('⚠️ npm install не сработал, пробуем альтернативный метод...', 'warning');
    }

    // Альтернативный метод: глобальная установка + копирование
    try {
      this.log('📦 Устанавливаем 7zip-bin глобально...', 'info');
      await this.runCommand('npm', ['install', '-g', '7zip-bin@5.2.0'], this.playerPath);

      // Находим путь к глобальному 7zip-bin
      const globalNpmPath = process.platform === 'win32' 
        ? path.join(process.env.APPDATA, 'npm', 'node_modules', '7zip-bin')
        : '/usr/local/lib/node_modules/7zip-bin';

      if (fs.existsSync(globalNpmPath)) {
        this.log(`📦 Копируем 7zip-bin из ${globalNpmPath}...`, 'info');
        await this.copyDirectory(globalNpmPath, sevenZipPath);
        this.log('✓ 7zip-bin установлен через глобальную установку', 'success');
      } else {
        throw new Error('Не удалось найти глобально установленный 7zip-bin');
      }

    } catch (error) {
      throw new Error(`Не удалось установить 7zip-bin: ${error.message}`);
    }
  }

  async copyDirectory(src, dest) {
    // Создаём целевую директорию
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Читаем содержимое исходной директории
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
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
        
        // Логируем важные строки
        const lines = text.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed && (
            trimmed.includes('✓') || 
            trimmed.includes('✔') || 
            trimmed.includes('built') ||
            trimmed.includes('packages') ||
            trimmed.includes('added') ||
            trimmed.includes('building') ||
            trimmed.includes('packaging')
          )) {
            this.log(trimmed, 'info');
          }
        });
      });

      process.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        
        // Игнорируем обычные warnings
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
