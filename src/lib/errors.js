// Custom error classes for better error handling

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service) {
    super(`${service} service is unavailable`, 503, 'SERVICE_UNAVAILABLE');
  }
}

// Error handler for API routes
export function handleApiError(error) {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    return {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors,
      statusCode: 400,
    };
  }

  // Default error
  return {
    error: error.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
}
