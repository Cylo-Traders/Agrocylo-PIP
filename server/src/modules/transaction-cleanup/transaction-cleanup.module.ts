import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TransactionCleanupService } from './transaction-cleanup.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [TransactionCleanupService],
})
export class TransactionCleanupModule {}
