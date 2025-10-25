const isDevelopment = (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV === 'development';

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

let enableDebugLogging = false;

export function setDebugLogging(enabled: boolean) {
  enableDebugLogging = enabled;
}

function shouldLog(level: LogLevel): boolean {
  if (level === LOG_LEVELS.ERROR) return true;
  if (level === LOG_LEVELS.WARN) return isDevelopment;
  if (level === LOG_LEVELS.INFO) return isDevelopment;
  if (level === LOG_LEVELS.DEBUG) return isDevelopment && enableDebugLogging;
  return false;
}

export const logger = {
  error: (message: string, ...args: any[]) => {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: any[]) => {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  debug: (message: string, ...args: any[]) => {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};
