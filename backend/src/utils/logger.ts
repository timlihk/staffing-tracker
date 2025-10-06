import { inspect } from 'util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const levelToConsole: Record<LogLevel, (message?: unknown, ...optionalParams: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const serialize = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === 'development' ? value.stack : undefined,
    };
  }
  if (typeof value === 'object' && value !== null) {
    return value;
  }
  return value;
};

class Logger {
  private readonly context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  child(childContext: LogContext): Logger {
    return new Logger({ ...this.context, ...childContext });
  }

  debug(message: string, meta: LogContext = {}) {
    this.log('debug', message, meta);
  }

  info(message: string, meta: LogContext = {}) {
    this.log('info', message, meta);
  }

  warn(message: string, meta: LogContext = {}) {
    this.log('warn', message, meta);
  }

  error(message: string, meta: LogContext = {}) {
    this.log('error', message, meta);
  }

  private log(level: LogLevel, message: string, meta: LogContext) {
    const output = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...Object.fromEntries(
        Object.entries(meta).map(([key, value]) => [key, serialize(value)])
      ),
    };

    const consoleFn = levelToConsole[level];
    consoleFn(JSON.stringify(output));
  }
}

export const logger = new Logger();
export type AppLogger = Logger;
