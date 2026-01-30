// Logging utility for consistent logging across the app

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

class Logger {
  constructor() {
    this.isDev = process.env.NODE_ENV === 'development';
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };

    return this.isDev
      ? JSON.stringify(logEntry, null, 2)
      : JSON.stringify(logEntry);
  }

  error(message, error = null) {
    const data = error
      ? {
          error: error.message,
          stack: this.isDev ? error.stack : undefined,
        }
      : null;
    console.error(this.formatMessage(LOG_LEVELS.ERROR, message, data));
  }

  warn(message, data = null) {
    console.warn(this.formatMessage(LOG_LEVELS.WARN, message, data));
  }

  info(message, data = null) {
    console.log(this.formatMessage(LOG_LEVELS.INFO, message, data));
  }

  debug(message, data = null) {
    if (this.isDev) {
      console.log(this.formatMessage(LOG_LEVELS.DEBUG, message, data));
    }
  }

  // API request logging
  apiRequest(method, path, data = null) {
    this.info(`API Request: ${method} ${path}`, data);
  }

  apiResponse(method, path, statusCode, duration = null) {
    this.info(`API Response: ${method} ${path}`, {
      statusCode,
      ...(duration && { duration: `${duration}ms` }),
    });
  }
}

export const logger = new Logger();
