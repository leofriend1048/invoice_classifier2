/**
 * Server-side initialization
 * This should be imported in API routes and server components
 */

import { setupProcessErrorHandlers } from './process-error-handler';

// Initialize process error handlers for server-side code
if (typeof window === 'undefined') {
  setupProcessErrorHandlers();
}
