/* ============================================================================
   Custom Error Classes
   ----------------------------------------------------------------------------
   Use these instead of throwing plain Error so errorHandler can map them
   to proper HTTP status codes with structured details.
   ========================================================================= */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_REQUIRED');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'You are not allowed to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

class PaymentRequiredError extends AppError {
  constructor(message = 'Not enough tokens', details = null) {
    super(message, 402, 'PAYMENT_REQUIRED', details);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service, message = null) {
    super(message || `${service} is unavailable`, 503, 'SERVICE_UNAVAILABLE', { service });
  }
}

class ExternalAPIError extends AppError {
  constructor(service, originalMessage) {
    super(`${service} API error: ${originalMessage}`, 502, 'EXTERNAL_API_ERROR', { service });
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  PaymentRequiredError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ExternalAPIError
};
