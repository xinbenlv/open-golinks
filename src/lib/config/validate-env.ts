/**
 * Environment variable validation
 * Runs at application startup to ensure required configuration
 */

export interface EnvValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check Turnstile configuration
  const turnstileBypass = process.env.TURNSTILE_BYPASS === '1';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;

  if (turnstileBypass) {
    warnings.push('⚠️ Turnstile is bypassed (TURNSTILE_BYPASS=1) - development mode only');
  } else if (!turnstileSiteKey || !turnstileSecretKey) {
    errors.push(
      'Turnstile not configured. Either:\n' +
      '  1. Set TURNSTILE_BYPASS=1 for development (skips verification)\n' +
      '  2. Or set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY for production'
    );
  }

  // Check database configuration
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push('DATABASE_URL environment variable is required');
  }

  // Check Supabase configuration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    warnings.push('Supabase not configured (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Log validation results
 */
export function logValidationResults(result: EnvValidationResult): void {
  if (result.errors.length > 0) {
    console.error('\n❌ Environment configuration errors:');
    result.errors.forEach((error) => {
      console.error(`  - ${error}`);
    });
    console.error();
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️ Environment warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`  - ${warning}`);
    });
    console.warn();
  }

  if (result.valid) {
    console.log('✓ Environment configuration valid\n');
  }
}
