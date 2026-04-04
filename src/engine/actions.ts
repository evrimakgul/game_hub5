import type { ActionContext } from "./context.ts";
import type { Effect } from "./effects.ts";

export abstract class Action {
  private readonly warnings: string[] = [];
  private manaCost = 0;
  private targetCharacterIds: string[] | null = null;

  protected addWarning(message: string): void {
    this.warnings.push(message);
  }

  protected setManaCost(value: number): void {
    this.manaCost = Math.max(0, Math.trunc(value));
  }

  protected setTargetCharacterIds(value: string[]): void {
    this.targetCharacterIds = [...value];
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  getManaCost(_context: ActionContext): number {
    return this.manaCost;
  }

  getTargetCharacterIds(context: ActionContext): string[] {
    return this.targetCharacterIds ?? context.finalTargets.map((target) => target.id);
  }

  abstract resolve(context: ActionContext): Effect[];
}

export abstract class AttackSpellAction extends Action {}
export abstract class BuffSpellAction extends Action {}
export abstract class AuraSpellAction extends Action {}
export abstract class ControlSpellAction extends Action {}
export abstract class SummonSpellAction extends Action {}
export abstract class RestorationSpellAction extends Action {}
export abstract class KnowledgeSpellAction extends Action {}
export abstract class UtilitySpellAction extends Action {}
