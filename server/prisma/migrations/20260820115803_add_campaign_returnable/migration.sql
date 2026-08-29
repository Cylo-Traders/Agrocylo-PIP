-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmer" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "targetAmount" BIGINT,
    "tokenAddress" TEXT,
    "deadline" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "totalFunded" BIGINT NOT NULL DEFAULT 0,
    "escrowContract" TEXT NOT NULL DEFAULT '',
    "trancheCount" INTEGER,
    "harvestOutcome" TEXT,
    "harvestReportedAt" BIGINT,
    "refundable" BIGINT NOT NULL DEFAULT 0,
    "returnable" BIGINT NOT NULL DEFAULT 0,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Campaign" ("createdAt", "deadline", "description", "escrowContract", "farmer", "harvestOutcome", "harvestReportedAt", "id", "refundable", "status", "targetAmount", "title", "tokenAddress", "totalFunded", "trancheCount", "updatedAt") SELECT "createdAt", "deadline", "description", "escrowContract", "farmer", "harvestOutcome", "harvestReportedAt", "id", coalesce("refundable", 0) AS "refundable", "status", "targetAmount", "title", "tokenAddress", "totalFunded", "trancheCount", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
