import { runActionsTests } from "./actions.test.ts";
import { runCombatAuthTests } from "./combatAuth.test.ts";
import { runCombatIntegrationTests } from "./combatIntegration.test.ts";
import { runCombatReducerTests } from "./combatReducer.test.ts";
import { runCombatRuntimeTests } from "./combatRuntime.test.ts";
import { runCombatTests } from "./combat.test.ts";
import { runCombatUiSelectorsTests } from "./combatUiSelectors.test.ts";
import { runPowerRuntimeTests } from "./powerRuntime.test.ts";
import { runStatsTests } from "./stats.test.ts";
import { runXpTablesTests } from "./xpTables.test.ts";

async function main(): Promise<void> {
  await runXpTablesTests();
  await runStatsTests();
  await runCombatTests();
  await runActionsTests();
  await runCombatReducerTests();
  await runCombatUiSelectorsTests();
  await runCombatRuntimeTests();
  await runCombatAuthTests();
  await runPowerRuntimeTests();
  await runCombatIntegrationTests();
  console.log("ALL TESTS PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
