import type { ActionContext } from "../engine/context.ts";
import type { Action } from "../engine/actions.ts";
import type { PowerModule } from "./types.ts";
import { awarenessModule } from "./awareness.ts";
import { bodyReinforcementModule } from "./bodyReinforcement.ts";
import { crowdControlModule } from "./crowdControl.ts";
import { elementalistModule } from "./elementalist.ts";
import { healingModule } from "./healing.ts";
import { lightSupportModule } from "./lightSupport.ts";
import { necromancyModule } from "./necromancy.ts";
import { shadowControlModule } from "./shadowControl.ts";

const powerModules: PowerModule[] = [
  awarenessModule,
  bodyReinforcementModule,
  crowdControlModule,
  elementalistModule,
  healingModule,
  lightSupportModule,
  necromancyModule,
  shadowControlModule,
];

const powerModuleById = new Map(powerModules.map((module) => [module.powerId, module]));

export function getPowerModuleById(powerId: string): PowerModule | null {
  return powerModuleById.get(powerId) ?? null;
}

export function createActionForContext(context: ActionContext): Action | null {
  const powerId = context.selectedPower?.id ?? null;

  if (!powerId) {
    return null;
  }

  return getPowerModuleById(powerId)?.createAction(context) ?? null;
}

export function getPowerModules(): PowerModule[] {
  return [...powerModules];
}
