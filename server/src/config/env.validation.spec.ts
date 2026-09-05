import { envValidationSchema } from './env.validation';

describe('environment validation', () => {
  it('accepts a comma-separated CORS origin allowlist', () => {
    const result = envValidationSchema.validate({
      CORS_ALLOWED_ORIGINS:
        'https://app.agrocylo.example,https://admin.agrocylo.example',
    });

    expect(result.error).toBeUndefined();
  });

  it.each(['*', 'https://app.agrocylo.example,*', '   '])(
    'rejects a non-explicit CORS allowlist: %s',
    (corsAllowedOrigins) => {
      const result = envValidationSchema.validate({
        CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
      });

      expect(result.error?.message).toContain(
        'must contain explicit origins and cannot include "*"',
      );
    },
  );

  describe('DATABASE_URL in production', () => {
    it('accepts a real database URI', () => {
      const result = envValidationSchema.validate({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost/db',
        CORS_ALLOWED_ORIGINS: 'https://app.agrocylo.example',
      });

      expect(result.error).toBeUndefined();
    });

    it('rejects a local SQLite file path', () => {
      const result = envValidationSchema.validate({
        NODE_ENV: 'production',
        DATABASE_URL: 'file:./dev.db',
        CORS_ALLOWED_ORIGINS: 'https://app.agrocylo.example',
      });

      expect(result.error?.message).toContain(
        'DATABASE_URL" in production must be a real database URI',
      );
    });

    it('rejects a relative file path without scheme', () => {
      const result = envValidationSchema.validate({
        NODE_ENV: 'production',
        DATABASE_URL: './dev.db',
        CORS_ALLOWED_ORIGINS: 'https://app.agrocylo.example',
      });

      expect(result.error?.message).toContain(
        'DATABASE_URL" in production must be a real database URI',
      );
    });

    it('requires DATABASE_URL to be present in production', () => {
      const result = envValidationSchema.validate({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://app.agrocylo.example',
      });

      expect(result.error?.message).toContain('DATABASE_URL');
    });
  });

  describe('DATABASE_URL in development', () => {
    it('allows the default SQLite file path', () => {
      const result = envValidationSchema.validate({
        NODE_ENV: 'development',
        CORS_ALLOWED_ORIGINS: 'https://app.agrocylo.example',
      });

      expect(result.error).toBeUndefined();
      expect(result.value.DATABASE_URL).toBe('file:./dev.db');
    });

    it('accepts a real database URI too', () => {
      const result = envValidationSchema.validate({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://user:pass@localhost/db',
        CORS_ALLOWED_ORIGINS: 'https://app.agrocylo.example',
      });

      expect(result.error).toBeUndefined();
    });
  });
});
