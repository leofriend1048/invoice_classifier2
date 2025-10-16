/**
 * Process-level error handling to prevent unexpected crashes
 * This should be imported early in the application lifecycle
 */

export function setupProcessErrorHandlers() {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Don't exit the process immediately - log and continue
    // In production, this should be handled by the process manager
    console.error('⚠️ Process will continue running despite uncaught exception');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Promise Rejection:', {
      reason: reason instanceof Error ? {
        name: reason.name,
        message: reason.message,
        stack: reason.stack
      } : reason,
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });
    
    // Don't exit the process - log and continue
    console.error('⚠️ Process will continue running despite unhandled rejection');
  });

  // Handle SIGTERM gracefully
  process.on('SIGTERM', () => {
    console.log('📡 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });

  // Handle SIGINT gracefully
  process.on('SIGINT', () => {
    console.log('📡 Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });

  // Handle process warnings
  process.on('warning', (warning) => {
    console.warn('⚠️ Process Warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
      timestamp: new Date().toISOString()
    });
  });

  console.log('✅ Process error handlers configured');
}

/**
 * Enhanced error logging utility
 */
export function logError(context: string, error: unknown, additionalInfo?: Record<string, unknown>) {
  const errorInfo = {
    context,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };

  if (error instanceof Error) {
    console.error('❌ Error:', {
      ...errorInfo,
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  } else {
    console.error('❌ Error:', {
      ...errorInfo,
      error: String(error)
    });
  }
}

/**
 * Safe async wrapper that catches and logs errors
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logError(context, error);
    return fallback;
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: string = 'retry operation'
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        logError(`${context} (final attempt ${attempt}/${maxRetries})`, error);
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.warn(`⚠️ ${context} attempt ${attempt}/${maxRetries} failed, retrying in ${Math.round(delay)}ms:`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
