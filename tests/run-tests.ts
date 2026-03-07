import { runCombatEncounterTests } from "./combatEncounter.test.ts";
import { runStatsTests } from "./stats.test.ts";
import { runXpTablesTests } from "./xpTables.test.ts";

async function main(): Promise<void> {
  await runXpTablesTests();
  await runStatsTests();
  await runCombatEncounterTests();
  console.log("ALL TESTS PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
