import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const baseValidEnv = {
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  };

  describe('DATABASE_URL validation across environments', () => {
    it('defaults DATABASE_URL to file:./dev.db in development', () => {
      const { value, error } = envValidationSchema.validate({
        ...baseValidEnv,
        NODE_ENV: 'development',
      });
      expect(error).toBeUndefined();
      expect(value.DATABASE_URL).toBe('file:./dev.db');
    });

    it('defaults DATABASE_URL to file:./dev.db in test', () => {
      const { value, error } = envValidationSchema.validate({
        ...baseValidEnv,
        NODE_ENV: 'test',
      });
      expect(error).toBeUndefined();
      expect(value.DATABASE_URL).toBe('file:./dev.db');
    });

    it('fails fast on startup in production when DATABASE_URL is missing', () => {
      const { error } = envValidationSchema.validate({
        ...baseValidEnv,
        NODE_ENV: 'production',
      });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /DATABASE_URL is required in production environment/,
      );
    });

    it('fails fast on startup in production when DATABASE_URL points to default dev.db', () => {
      const { error } = envValidationSchema.validate({
        ...baseValidEnv,
        NODE_ENV: 'production',
        DATABASE_URL: 'file:./dev.db',
      });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /DATABASE_URL cannot use default embedded SQLite file:\.\/dev\.db in production|DATABASE_URL cannot be a local file: URI in production/,
      );
    });

    it('fails fast on startup in production when DATABASE_URL points to any local file: path', () => {
      const { error } = envValidationSchema.validate({
        ...baseValidEnv,
        NODE_ENV: 'production',
        DATABASE_URL: 'file:/var/data/prod.db',
      });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(
        /DATABASE_URL cannot be a local file: URI in production/,
      );
    });

    it('succeeds in production when DATABASE_URL is a valid remote connection string (libsql / postgres / turso)', () => {
      const { value, error } = envValidationSchema.validate({
        ...baseValidEnv,
        NODE_ENV: 'production',
        DATABASE_URL:
          'libsql://agrocylo-prod.turso.io?authToken=secretToken123',
      });
      expect(error).toBeUndefined();
      expect(value.DATABASE_URL).toBe(
        'libsql://agrocylo-prod.turso.io?authToken=secretToken123',
      );
    });
  });
});
