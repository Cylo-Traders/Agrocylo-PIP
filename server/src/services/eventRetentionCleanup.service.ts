export interface RetentionCleanupResult {
  deletedRows: number;
  retentionDays: number;
  durationMs: number;
}

export class EventRetentionCleanupService {
  public async cleanupOldAuditEvents(
    eventRetentionDays: number = 7,
    mockDeleteFn?: (cutoffDate: Date) => Promise<number>
  ): Promise<RetentionCleanupResult> {
    const startTime = Date.now();
    const cutoffDate = new Date(Date.now() - eventRetentionDays * 24 * 60 * 60 * 1000);
    
    const deletedRows = mockDeleteFn ? await mockDeleteFn(cutoffDate) : 0;
    const durationMs = Date.now() - startTime;

    return {
      deletedRows,
      retentionDays: eventRetentionDays,
      durationMs,
    };
  }
}

export const eventRetentionCleanupService = new EventRetentionCleanupService();
