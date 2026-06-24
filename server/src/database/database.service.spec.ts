import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let logger: jest.Mocked<Pick<PinoLogger, 'info' | 'warn' | 'setContext'>>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      setContext: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createService() {
    if (!configService.get.getMockImplementation()) {
      configService.get.mockImplementation((key: string) => {
        if (key === 'database.url') {
          return 'postgresql://postgres:postgres@localhost:5432/agrocylo_pip_test?schema=public';
        }
        return undefined;
      });
    }

    return new DatabaseService(
      configService as unknown as ConfigService,
      logger as unknown as PinoLogger,
    );
  }

  it('connects on module init when startup connection is enabled', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'database.url') {
        return 'postgresql://postgres:postgres@localhost:5432/agrocylo_pip_test?schema=public';
      }
      if (key === 'database.connectOnStartup') return true;
      return undefined;
    });
    const service = createService();
    const connect = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(logger.setContext).toHaveBeenCalledWith(DatabaseService.name);
    expect(configService.get).toHaveBeenCalledWith('database.connectOnStartup');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Database connection established');
  });

  it('skips startup connection when disabled', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'database.url') {
        return 'postgresql://postgres:postgres@localhost:5432/agrocylo_pip_test?schema=public';
      }
      if (key === 'database.connectOnStartup') return false;
      return undefined;
    });
    const service = createService();
    const connect = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Database startup connection disabled',
    );
  });

  it('disconnects on module destroy', async () => {
    const service = createService();
    const disconnect = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Database connection closed');
  });
});
