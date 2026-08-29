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
});
