-- CreateTable
CREATE TABLE "indexer_states" (
    "id" TEXT NOT NULL DEFAULT 'soroban',
    "last_processed_ledger" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indexer_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "type" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "tx_hash" TEXT,
    "topic" JSONB,
    "payload" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "blockchain_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_events_event_id_key" ON "blockchain_events"("event_id");

-- CreateIndex
CREATE INDEX "blockchain_events_contract_id_ledger_idx" ON "blockchain_events"("contract_id", "ledger");

-- CreateIndex
CREATE INDEX "blockchain_events_ledger_idx" ON "blockchain_events"("ledger");
