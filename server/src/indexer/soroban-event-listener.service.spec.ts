import { SorobanEventListenerService } from './soroban-event-listener.service';

function makeCursorStore() {
  const rows: Record<
    string,
    { contractId: string; lastProcessedLedger: number }
  > = {};
  return {
    rows,
    findMany: jest.fn(async ({ where }: any) => {
      const ids: string[] = where.contractId.in;
      return ids.filter((id) => rows[id]).map((id) => rows[id]);
    }),
    upsert: jest.fn(async ({ where, create, update }: any) => {
      const id = where.contractId as string;
      rows[id] = rows[id] ? { ...rows[id], ...update } : { ...create };
      return rows[id];
    }),
  };
}

function makeConfigService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'soroban.rpcUrl': 'https://example.invalid',
    'soroban.productionEscrowContractId': 'CESCROW1',
    'soroban.escrowContractId': '',
    'soroban.eventPollIntervalMs': 5000,
    'soroban.indexerStartLedger': undefined,
    ...overrides,
  };
  return { get: jest.fn((key: string) => values[key]) } as any;
}

function makeEventParser() {
  return { processEvent: jest.fn().mockResolvedValue(undefined) } as any;
}

function buildService(prisma: any, configService: any, eventParser: any) {
  const service = new SorobanEventListenerService(
    configService,
    eventParser,
    prisma,
  );
  // Bypass onModuleInit's real @stellar/stellar-sdk import - tests drive the
  // RPC server and scValToNative decoding directly.
  (service as any).scValToNative = (v: unknown) => v;
  (service as any).logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
  return service;
}

describe('SorobanEventListenerService', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it('falls back to the current latest ledger when no cursor is persisted yet', async () => {
    const cursorStore = makeCursorStore();
    const prisma = { indexerCursor: cursorStore };
    const configService = makeConfigService();
    const eventParser = makeEventParser();
    const service = buildService(prisma, configService, eventParser);

    const rpcServer = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 1000 }),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };
    (service as any).rpcServer = rpcServer;

    await service.startListening();

    expect(rpcServer.getLatestLedger).toHaveBeenCalledTimes(1);
    expect((service as any).lastProcessedLedger).toBe(1000);

    await service.stopListening();
  });

  it('reads the persisted cursor on init instead of jumping to the latest ledger', async () => {
    const cursorStore = makeCursorStore();
    cursorStore.rows['CESCROW1'] = {
      contractId: 'CESCROW1',
      lastProcessedLedger: 500,
    };
    const prisma = { indexerCursor: cursorStore };
    const configService = makeConfigService();
    const eventParser = makeEventParser();
    const service = buildService(prisma, configService, eventParser);

    const rpcServer = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 10000 }),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };
    (service as any).rpcServer = rpcServer;

    await service.startListening();

    // A cursor row already exists, so startup must not call getLatestLedger
    // to decide where to resume from.
    expect(rpcServer.getLatestLedger).not.toHaveBeenCalled();
    expect((service as any).lastProcessedLedger).toBe(500);

    await (service as any).pollEvents();

    expect(rpcServer.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ startLedger: 501 }),
    );

    await service.stopListening();
  });

  it('advances and persists the cursor after processing a batch of events', async () => {
    const cursorStore = makeCursorStore();
    cursorStore.rows['CESCROW1'] = {
      contractId: 'CESCROW1',
      lastProcessedLedger: 500,
    };
    const prisma = { indexerCursor: cursorStore };
    const configService = makeConfigService();
    const eventParser = makeEventParser();
    const service = buildService(prisma, configService, eventParser);

    const rpcServer = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 510 }),
      getEvents: jest.fn().mockResolvedValue({
        events: [
          {
            id: 'ev1',
            topic: ['CampaignFunded', 1n],
            value: [1700000000n, 100n],
            ledger: 505,
            contractId: 'CESCROW1',
            txHash: 'tx1',
          },
        ],
      }),
    };
    (service as any).rpcServer = rpcServer;

    await service.startListening();
    await (service as any).pollEvents();

    expect(eventParser.processEvent).toHaveBeenCalledTimes(1);
    expect(cursorStore.rows['CESCROW1'].lastProcessedLedger).toBe(510);
    expect((service as any).lastProcessedLedger).toBe(510);

    await service.stopListening();
  });

  it('does not advance the cursor when the poll cycle fails', async () => {
    const cursorStore = makeCursorStore();
    cursorStore.rows['CESCROW1'] = {
      contractId: 'CESCROW1',
      lastProcessedLedger: 500,
    };
    const prisma = { indexerCursor: cursorStore };
    const configService = makeConfigService();
    const eventParser = makeEventParser();
    const service = buildService(prisma, configService, eventParser);

    const rpcServer = {
      getLatestLedger: jest
        .fn()
        .mockRejectedValue(new Error('RPC unavailable')),
      getEvents: jest.fn(),
    };
    (service as any).rpcServer = rpcServer;

    await service.startListening();
    await (service as any).pollEvents();

    expect(cursorStore.rows['CESCROW1'].lastProcessedLedger).toBe(500);

    await service.stopListening();
  });

  it('resumes from the persisted cursor after a simulated crash and restart, processing downtime events', async () => {
    const cursorStore = makeCursorStore();
    const prisma = { indexerCursor: cursorStore };
    const configService = makeConfigService();

    // --- First process lifecycle ---
    const eventParserA = makeEventParser();
    const serviceA = buildService(prisma, configService, eventParserA);
    const rpcServerA = {
      // First call resolves the boot cursor (no persisted row yet); the
      // second simulates a new ledger having closed by the next poll tick.
      getLatestLedger: jest
        .fn()
        .mockResolvedValueOnce({ sequence: 1000 })
        .mockResolvedValueOnce({ sequence: 1002 }),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };
    (serviceA as any).rpcServer = rpcServerA;

    await serviceA.startListening();
    await (serviceA as any).pollEvents();
    await serviceA.stopListening();

    expect(cursorStore.rows['CESCROW1'].lastProcessedLedger).toBe(1002);

    // --- Simulated crash: events happen while nothing is running ---
    const downtimeEvent = {
      id: 'downtime-ev1',
      topic: ['CampaignFunded', 42n],
      value: [1700000100n, 250n],
      ledger: 1003,
      contractId: 'CESCROW1',
      txHash: 'tx-downtime',
    };

    // --- Restart: a fresh service instance, same persisted cursor store ---
    const eventParserB = makeEventParser();
    const serviceB = buildService(prisma, configService, eventParserB);
    const rpcServerB = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 1005 }),
      getEvents: jest.fn().mockResolvedValue({ events: [downtimeEvent] }),
    };
    (serviceB as any).rpcServer = rpcServerB;

    await serviceB.startListening();

    // Must resume from the persisted cursor (1002), not jump to the new tip.
    expect(rpcServerB.getLatestLedger).not.toHaveBeenCalled();
    expect((serviceB as any).lastProcessedLedger).toBe(1002);

    await (serviceB as any).pollEvents();

    expect(rpcServerB.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ startLedger: 1003 }),
    );
    expect(eventParserB.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'downtime-ev1' }),
    );
    expect(cursorStore.rows['CESCROW1'].lastProcessedLedger).toBe(1005);

    await serviceB.stopListening();
  });

  it('does not reprocess an event id already seen in this run', async () => {
    const cursorStore = makeCursorStore();
    cursorStore.rows['CESCROW1'] = {
      contractId: 'CESCROW1',
      lastProcessedLedger: 500,
    };
    const prisma = { indexerCursor: cursorStore };
    const configService = makeConfigService();
    const eventParser = makeEventParser();
    const service = buildService(prisma, configService, eventParser);

    const event = {
      id: 'dup-1',
      topic: ['CampaignFunded', 1n],
      value: [1700000000n, 1n],
      ledger: 505,
      contractId: 'CESCROW1',
      txHash: 'tx1',
    };
    const rpcServer = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 505 }),
      getEvents: jest.fn().mockResolvedValue({ events: [event, event] }),
    };
    (service as any).rpcServer = rpcServer;

    await service.startListening();
    await (service as any).pollEvents();

    expect(eventParser.processEvent).toHaveBeenCalledTimes(1);

    await service.stopListening();
  });
});
