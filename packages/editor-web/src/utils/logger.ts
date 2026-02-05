/**
 * Logger utility для записи событий и ошибок
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 100;

  /**
   * Логировать сообщение
   */
  log(level: LogLevel, message: string, details?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    };

    this.logs.push(entry);

    // Ограничить размер массива
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Вывод в консоль
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(`[${level.toUpperCase()}] ${message}`, details || '');
  }

  info(message: string, details?: any): void {
    this.log('info', message, details);
  }

  warn(message: string, details?: any): void {
    this.log('warn', message, details);
  }

  error(message: string, details?: any): void {
    this.log('error', message, details);
  }

  /**
   * Получить все логи
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Очистить логи
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Экспорт логов в JSON
   */
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();
