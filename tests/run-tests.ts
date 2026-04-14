import { runAppFlowPersistenceTests } from "./appFlowPersistence.test.ts";
import { runCharacterRuntimeTests } from "./characterRuntime.test.ts";
import { runCombatEncounterCastingTests } from "./combatEncounterCasting.test.ts";
import { runCombatEncounterPhysicalAttackTests } from "./combatEncounterPhysicalAttacks.test.ts";
import { runCombatEncounterSpecialActionTests } from "./combatEncounterSpecialActions.test.ts";
import { runCombatResolutionTests } from "./combatResolution.test.ts";
import { runCombatEncounterTests } from "./combatEncounter.test.ts";
import { runLibHelpersTests } from "./libHelpers.test.ts";
import { runEncounterExecutionEngineTests } from "./encounterExecutionEngine.test.ts";
import { runItemBehaviorTests } from "./itemBehaviors.test.ts";
import { runKnowledgeTests } from "./knowledge.test.ts";
import { runPowerEffectsTests } from "./powerEffects.test.ts";
import { runPowerRegistryTests } from "./powerRegistry.test.ts";
import { runStatsTests } from "./stats.test.ts";
import { runViewModelSelectorTests } from "./viewModelSelectors.test.ts";
import { runWorldCastingTests } from "./worldCasting.test.ts";
import { runXpTablesTests } from "./xpTables.test.ts";

async function main(): Promise<void> {
  await runXpTablesTests();
  await runStatsTests();
  await runLibHelpersTests();
  await runItemBehaviorTests();
  await runKnowledgeTests();
  await runAppFlowPersistenceTests();
  await runCharacterRuntimeTests();
  await runCombatResolutionTests();
  await runCombatEncounterTests();
  await runEncounterExecutionEngineTests();
  await runCombatEncounterPhysicalAttackTests();
  await runCombatEncounterSpecialActionTests();
  await runCombatEncounterCastingTests();
  await runPowerEffectsTests();
  await runPowerRegistryTests();
  await runWorldCastingTests();
  await runViewModelSelectorTests();
  console.log("ALL TESTS PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
