/**
 * Client-side logging utility
 * Only shows logs in development mode by default
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  isDevelopment: boolean;
}

class ClientLogger {
  private config: LogConfig;

  constructor() {
    this.config = {
      level: this.getLogLevel(),
      enableConsole: this.shouldEnableConsole(),
      isDevelopment: this.isDevelopment(),
    };
  }

  private isDevelopment(): boolean {
    return import.meta.env.MODE === 'development' ||
      import.meta.env.DEV ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
  }

  private getLogLevel(): LogLevel {
    const envLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default: return this.isDevelopment() ? LogLevel.DEBUG : LogLevel.ERROR;
    }
  }

  private shouldEnableConsole(): boolean {
    return this.isDevelopment() || import.meta.env.VITE_ENABLE_CONSOLE_LOGS === 'true';
  }

  private formatMessage(level: string, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return args.length > 0 ? `${prefix} ${message}` : `${prefix} ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  error(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    if (this.config.enableConsole) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    if (this.config.enableConsole) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    if (this.config.enableConsole) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    if (this.config.enableConsole) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  // Convenience method for development-only logs
  dev(message: string, ...args: unknown[]): void {
    if (this.config.isDevelopment) {
      console.log(`[DEV] ${message}`, ...args);
    }
  }
}

// Export singleton instance
export const logger = new ClientLogger();

// Export convenience functions
export const log = {
  error: (message: string, ...args: unknown[]) => logger.error(message, ...args),
  warn: (message: string, ...args: unknown[]) => logger.warn(message, ...args),
  info: (message: string, ...args: unknown[]) => logger.info(message, ...args),
  debug: (message: string, ...args: unknown[]) => logger.debug(message, ...args),
  dev: (message: string, ...args: unknown[]) => logger.dev(message, ...args),
};