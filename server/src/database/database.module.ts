import { Global, Module } from '@nestjs/common';
import { LoggerModule } from '../common/logger/logger.module';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
