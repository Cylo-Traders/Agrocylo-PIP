import { ConfigService } from '@nestjs/config';
import { CorsSocketIoAdapter } from './cors-socket-io.adapter';

describe('CorsSocketIoAdapter', () => {
  let adapter: CorsSocketIoAdapter;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockAppContext: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockAppContext = {
      get: jest.fn().mockReturnValue(mockConfigService),
    };

    adapter = new CorsSocketIoAdapter(mockAppContext);
  });

  it('configures Socket.IO server with cors origin from app config and allowRequest validation', () => {
    mockConfigService.get.mockReturnValue(['http://allowed.com']);

    const createIOServerSpy = jest
      .spyOn(
        Object.getPrototypeOf(CorsSocketIoAdapter.prototype),
        'createIOServer',
      )
      .mockReturnValue({} as any);

    adapter.createIOServer(3000, { path: '/ws' } as any);

    expect(mockConfigService.get).toHaveBeenCalledWith(
      'app.corsAllowedOrigins',
    );
    expect(createIOServerSpy).toHaveBeenCalledWith(
      3000,
      expect.objectContaining({
        path: '/ws',
        cors: {
          origin: ['http://allowed.com'],
          credentials: true,
        },
        allowRequest: expect.any(Function),
      }),
    );

    // Test allowRequest callback logic
    const serverOptions = createIOServerSpy.mock.calls[0][1] as any;
    const allowRequest = serverOptions.allowRequest;

    const cb1 = jest.fn();
    allowRequest({ headers: {} }, cb1);
    expect(cb1).toHaveBeenCalledWith(null, true);

    const cb2 = jest.fn();
    allowRequest({ headers: { origin: 'http://allowed.com' } }, cb2);
    expect(cb2).toHaveBeenCalledWith(null, true);

    const cb3 = jest.fn();
    allowRequest({ headers: { origin: 'http://evil.com' } }, cb3);
    expect(cb3).toHaveBeenCalledWith(
      'Origin not allowed by WebSocket CORS policy',
      false,
    );

    createIOServerSpy.mockRestore();
  });
});
