import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class SorobanEventListenerService implements OnModuleInit, OnModuleDestroy {
  private rpcServer: any;
  private StellarSdk: any;
  private isRunning = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastProcessedLedger = 0;
  private processedEventIds = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SorobanEventListenerService.name);
  }

  async onModuleInit() {
    const enabled = this.configService.get<boolean>('soroban.enabled') ?? true;
    if (!enabled) {
      this.logger.warn('Soroban event listener disabled');
      return;
    }

    this.StellarSdk = await import('@stellar/stellar-sdk');
    const rpcUrl = this.configService.get<string>('soroban.rpcUrl');
    this.rpcServer = new this.StellarSdk.rpc.Server(rpcUrl);
    this.logger.info({ rpcUrl }, 'Soroban Event Listener initialized');
    await this.startListening();
  }

  async onModuleDestroy() {
    await this.stopListening();
  }

  async startListening(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    const latestLedger = await this.rpcServer.getLatestLedger();
    this.lastProcessedLedger = latestLedger.sequence;
    this.logger.info({ ledger: this.lastProcessedLedger }, 'Starting event listener');
    const pollInterval = this.configService.get<number>('soroban.eventPollIntervalMs');
    this.pollingInterval = setInterval(() => void this.pollEvents(), pollInterval);
  }

  async stopListening(): Promise<void> {
    this.isRunning = false;
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.logger.info('Event listener stopped');
  }

  private async pollEvents(): Promise<void> {
    if (!this.isRunning) return;
    try {
      const contractIds = [
        this.configService.get<string>('soroban.productionEscrowContractId'),
        this.configService.get<string>('soroban.escrowContractId'),
      ].filter((id) => id && id.length > 0);
      if (contractIds.length === 0) return;
      const latestLedger = await this.rpcServer.getLatestLedger();
      const startLedger = this.lastProcessedLedger + 1;
      if (startLedger > latestLedger.sequence) return;
      const response = await this.rpcServer.getEvents({
        startLedger,
        filters: contractIds.map((contractId) => ({ type: 'contract', contractIds: [contractId] })),
        limit: 100,
      });
      if (response.events?.length > 0) {
        for (const event of response.events) {
          if (!this.processedEventIds.has(event.id)) {
            this.logger.info({ eventId: event.id, type: event.type, contractId: event.contractId, ledger: event.ledger, txHash: event.txHash }, 'Event received');
            this.processedEventIds.add(event.id);
          }
        }
      }
      this.lastProcessedLedger = latestLedger.sequence;
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error polling events');
    }
  }
}
