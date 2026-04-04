import { EffectContext, type ActionContext } from "./context.ts";
import type { Action } from "./actions.ts";

export function executeAction(action: Action, context: ActionContext) {
  const effects = action.resolve(context);
  const effectContext = new EffectContext(
    context.casterCharacter.id,
    action.getTargetCharacterIds(context),
    action.getManaCost(context)
  );

  effects.forEach((effect) => effect.apply(effectContext));

  return {
    request: effectContext.request,
    warnings: action.getWarnings(),
  };
}
