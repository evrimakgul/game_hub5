import { runActionsTests } from "./actions.test.ts";
import { runCombatTests } from "./combat.test.ts";
import { runPowersTests } from "./powers.test.ts";
import { runStatsTests } from "./stats.test.ts";
import { runXpTablesTests } from "./xpTables.test.ts";

async function main(): Promise<void> {
  await runXpTablesTests();
  await runStatsTests();
  await runCombatTests();
  await runActionsTests();
  await runPowersTests();
  console.log("ALL TESTS PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
