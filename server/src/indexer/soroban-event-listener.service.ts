import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import { EventParserService } from './parsers/event-parser.service';
import type { RawSorobanEvent } from './types/soroban-events.types';

@Injectable()
export class SorobanEventListenerService
  implements OnModuleInit, OnModuleDestroy
{
  // A plain Logger instance (rather than @InjectPinoLogger) so this doesn't
  // depend on nestjs-pino's per-class provider registration having already
  // run by the time LoggerModule is imported in app.module.ts - it's still
  // routed through Pino via app.useLogger() in main.ts.
  private readonly logger = new Logger(SorobanEventListenerService.name);
  private rpcServer: any;
  private scValToNative: (scv: unknown) => unknown;
  private isRunning = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastProcessedLedger = 0;
  private processedEventIds = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventParser: EventParserService,
    private readonly prisma: PrismaClient,
  ) {}

  async onModuleInit() {
    if (this.getContractIds().length === 0) {
      // Nothing configured to index yet (e.g. contracts not deployed for
      // this environment) - skip connecting to Soroban RPC entirely rather
      // than eagerly loading the SDK for no reason.
      this.logger.warn(
        'No Soroban contract IDs configured; event indexer disabled',
      );
      return;
    }

    const StellarSdk = await import('@stellar/stellar-sdk');
    const { Server } = await import('@stellar/stellar-sdk/rpc');
    this.scValToNative = StellarSdk.scValToNative;
    const rpcUrl = this.configService.get<string>('soroban.rpcUrl');
    if (!rpcUrl) {
      throw new Error('SOROBAN_RPC_URL is required');
    }
    this.rpcServer = new Server(rpcUrl);
    this.logger.log({ rpcUrl }, 'Soroban Event Listener initialized');
    await this.startListening();
  }

  async onModuleDestroy() {
    await this.stopListening();
  }

  private getContractIds(): string[] {
    return [
      this.configService.get<string>('soroban.productionEscrowContractId'),
      this.configService.get<string>('soroban.escrowContractId'),
    ].filter((id): id is string => !!id && id.length > 0);
  }

  /**
   * Reads the persisted per-contract cursor and resumes from
   * lastProcessedLedger + 1 on the next poll, instead of always jumping to
   * the current chain tip on restart (which would silently skip whatever
   * happened while the process was down). Falls back to the current latest
   * ledger - or the SOROBAN_INDEXER_START_LEDGER override - only when no
   * cursor row exists yet (first run for that contract).
   */
  private async loadCursor(contractIds: string[]): Promise<number> {
    if (contractIds.length === 0) return 0;

    const rows = await this.prisma.indexerCursor.findMany({
      where: { contractId: { in: contractIds } },
    });

    if (rows.length > 0) {
      return Math.min(...rows.map((row) => row.lastProcessedLedger));
    }

    const startLedgerOverride = this.configService.get<number>(
      'soroban.indexerStartLedger',
    );
    if (startLedgerOverride && startLedgerOverride > 0) {
      return startLedgerOverride - 1;
    }

    const latestLedger = await this.rpcServer.getLatestLedger();
    return latestLedger.sequence;
  }

  private async persistCursor(
    contractIds: string[],
    ledger: number,
  ): Promise<void> {
    await Promise.all(
      contractIds.map((contractId) =>
        this.prisma.indexerCursor.upsert({
          where: { contractId },
          update: { lastProcessedLedger: ledger },
          create: { contractId, lastProcessedLedger: ledger },
        }),
      ),
    );
  }

  async startListening(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    const contractIds = this.getContractIds();
    this.lastProcessedLedger = await this.loadCursor(contractIds);
    this.logger.log(
      { ledger: this.lastProcessedLedger },
      'Starting event listener',
    );
    const pollInterval = this.configService.get<number>(
      'soroban.eventPollIntervalMs',
    );
    this.pollingInterval = setInterval(
      () => void this.pollEvents(),
      pollInterval,
    );
  }

  async stopListening(): Promise<void> {
    this.isRunning = false;
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.logger.log('Event listener stopped');
  }

  private async pollEvents(): Promise<void> {
    if (!this.isRunning) return;
    try {
      const contractIds = this.getContractIds();
      if (contractIds.length === 0) return;
      const latestLedger = await this.rpcServer.getLatestLedger();
      const startLedger = this.lastProcessedLedger + 1;
      if (startLedger > latestLedger.sequence) return;
      const response = await this.rpcServer.getEvents({
        startLedger,
        filters: contractIds.map((contractId) => ({
          type: 'contract',
          contractIds: [contractId],
        })),
        limit: 100,
      });
      if (response.events?.length > 0) {
        for (const event of response.events) {
          if (!this.processedEventIds.has(event.id)) {
            this.processedEventIds.add(event.id);
            await this.processEvent(event);
          }
        }
      }
      this.lastProcessedLedger = latestLedger.sequence;
      await this.persistCursor(contractIds, this.lastProcessedLedger);
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error polling events',
      );
    }
  }

  private async processEvent(event: any): Promise<void> {
    const rawEvent: RawSorobanEvent = {
      id: event.id,
      type: event.type,
      contractId: event.contractId,
      topic: (event.topic ?? []).map((t: unknown) => this.scValToNative(t)),
      value: this.scValToNative(event.value ?? {}),
      ledger: event.ledger,
      ledgerClosedAt: event.ledgerClosedAt,
      txHash: event.txHash,
    };

    await this.eventParser.processEvent(rawEvent);

    this.logger.log(
      {
        eventId: event.id,
        contractId: event.contractId,
        ledger: event.ledger,
        txHash: event.txHash,
      },
      'Event processed and persisted',
    );
  }
}
