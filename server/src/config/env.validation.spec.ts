import { envValidationSchema } from './env.validation';

// Minimal set of otherwise-required vars, so each test isolates the one
// rule it exercises instead of tripping over an unrelated "is required".
const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/agrocylo',
};

describe('environment validation', () => {
  it('accepts a comma-separated CORS origin allowlist', () => {
    const result = envValidationSchema.validate({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS:
        'https://app.agrocylo.example,https://admin.agrocylo.example',
    });

    expect(result.error).toBeUndefined();
  });

  it.each(['*', 'https://app.agrocylo.example,*', '   '])(
    'rejects a non-explicit CORS allowlist: %s',
    (corsAllowedOrigins) => {
      const result = envValidationSchema.validate({
        ...baseEnv,
        CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
      });

      expect(result.error?.message).toContain(
        'must contain explicit origins and cannot include "*"',
      );
    },
  );

  it('requires a postgres DATABASE_URL', () => {
    const result = envValidationSchema.validate({
      CORS_ALLOWED_ORIGINS: 'https://app.agrocylo.example',
    });

    expect(result.error?.message).toContain('DATABASE_URL');
  });

  it('rejects a non-postgres DATABASE_URL scheme', () => {
    const result = envValidationSchema.validate({
      ...baseEnv,
      DATABASE_URL: 'file:./dev.db',
      CORS_ALLOWED_ORIGINS: 'https://app.agrocylo.example',
    });

    expect(result.error?.message).toContain('DATABASE_URL');
  });
});
