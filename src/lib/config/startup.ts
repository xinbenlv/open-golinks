/**
 * Application startup configuration
 * This file is imported in the root layout to validate environment on server start
 */

import { validateEnvironment, logValidationResults } from './validate-env';

let initialized = false;

export async function initializeApp(): Promise<void> {
  // Only run once
  if (initialized) return;
  initialized = true;

  // Validate environment
  const result = validateEnvironment();
  logValidationResults(result);

  // Exit if critical errors
  if (!result.valid) {
    throw new Error(
      'Application startup failed: Invalid environment configuration. ' +
      'Please check the errors above and set required environment variables.'
    );
  }
}
