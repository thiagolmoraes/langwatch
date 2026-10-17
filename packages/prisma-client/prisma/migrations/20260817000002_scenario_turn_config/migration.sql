-- Per-scenario turn configuration (ADR-015).
--
-- maxTurns caps the conversation length (SDK default: 10).
-- minTurns sets a floor before the judge can end the test.
--
-- Both nullable: NULL means "use SDK default". No backfill needed —
-- every existing scenario ran with the SDK default and should continue to.

-- Fork (deploy/hml): IF NOT EXISTS on purpose. Our older migration
-- 20260816120000_scenario_max_turns already added "maxTurns" in hml.
-- Plain ADD COLUMN would fail there and block the upgrade.

-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN IF NOT EXISTS "maxTurns" INTEGER;
ALTER TABLE "Scenario" ADD COLUMN IF NOT EXISTS "minTurns" INTEGER;

-- Down (manual — WARNING: dropping these columns permanently discards any
-- customer-configured turn limits; there is no recovery path):
--   ALTER TABLE "Scenario" DROP COLUMN "maxTurns";
--   ALTER TABLE "Scenario" DROP COLUMN "minTurns";
