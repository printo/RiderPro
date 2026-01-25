/**
 * Lightweight logging utility for development and production environments
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
  enableFile: boolean;
  isDevelopment: boolean;
}

class Logger {
  private config: LogConfig;

  constructor() {
    this.config = {
      level: this.getLogLevel(),
      enableConsole: this.shouldEnableConsole(),
      enableFile: false, // Keep simple for now
      isDevelopment: this.isDevelopment(),
    };
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === undefined ||
      typeof window !== 'undefined' && window.location.hostname === 'localhost';
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default: return this.isDevelopment() ? LogLevel.DEBUG : LogLevel.ERROR;
    }
  }

  private shouldEnableConsole(): boolean {
    // Always enable in development, or if explicitly set
    return this.isDevelopment() || process.env.ENABLE_CONSOLE_LOGS === 'true';
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

  // Update configuration
  updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  error: (message: string, ...args: unknown[]) => logger.error(message, ...args),
  warn: (message: string, ...args: unknown[]) => logger.warn(message, ...args),
  info: (message: string, ...args: unknown[]) => logger.info(message, ...args),
  debug: (message: string, ...args: unknown[]) => logger.debug(message, ...args),
  dev: (message: string, ...args: unknown[]) => logger.dev(message, ...args),
};