import type { ActivePowerEffect } from "../types/activePowerEffects.ts";
import type { EffectContext } from "./context.ts";
import type { PreparedCastRequest } from "../types/combatEncounterView.ts";

export abstract class Effect {
  abstract apply(context: EffectContext): void;
}

export class DamageEffect extends Effect {
  private readonly change: PreparedCastRequest["damageApplications"][number];

  constructor(change: PreparedCastRequest["damageApplications"][number]) {
    super();
    this.change = change;
  }

  apply(context: EffectContext): void {
    context.request.damageApplications.push(this.change);
  }
}

export class HealingEffect extends Effect {
  readonly change: PreparedCastRequest["healingApplications"][number];

  constructor(change: PreparedCastRequest["healingApplications"][number]) {
    super();
    this.change = change;
  }

  apply(context: EffectContext): void {
    context.request.healingApplications.push(this.change);
  }
}

export class ManaEffect extends Effect {
  private readonly change: {
    characterId: string;
    field: "currentMana";
    operation: "set" | "adjust";
    value: number;
  };

  constructor(change: {
    characterId: string;
    field: "currentMana";
    operation: "set" | "adjust";
    value: number;
  }) {
    super();
    this.change = change;
  }

  apply(context: EffectContext): void {
    context.request.resourceChanges.push(this.change);
  }
}

export class ResourceEffect extends Effect {
  private readonly change: PreparedCastRequest["resourceChanges"][number];

  constructor(change: PreparedCastRequest["resourceChanges"][number]) {
    super();
    this.change = change;
  }

  apply(context: EffectContext): void {
    context.request.resourceChanges.push(this.change);
  }
}

export class BuffEffect extends Effect {
  private readonly effect: ActivePowerEffect;

  constructor(effect: ActivePowerEffect) {
    super();
    this.effect = effect;
  }

  apply(context: EffectContext): void {
    context.addActiveEffect(this.effect);
  }
}

export class AuraEffect extends Effect {
  private readonly effects: ActivePowerEffect[];

  constructor(effects: ActivePowerEffect[]) {
    super();
    this.effects = effects;
  }

  apply(context: EffectContext): void {
    this.effects.forEach((effect) => context.addActiveEffect(effect));
  }
}

export class StatusEffect extends Effect {
  private readonly change: {
    characterId: string;
    operation: "add";
    tag: {
      id: string;
      label: string;
    };
  };

  constructor(change: {
    characterId: string;
    operation: "add";
    tag: {
      id: string;
      label: string;
    };
  }) {
    super();
    this.change = change;
  }

  apply(context: EffectContext): void {
    context.request.statusTagChanges.push(this.change);
  }
}

export class StatusRemovalEffect extends Effect {
  private readonly changes: Array<{
    characterId: string;
    operation: "remove";
    tag: {
      id: string;
      label: string;
    };
  }>;

  constructor(
    changes: Array<{
      characterId: string;
      operation: "remove";
      tag: {
        id: string;
        label: string;
      };
    }>
  ) {
    super();
    this.changes = changes;
  }

  apply(context: EffectContext): void {
    context.request.statusTagChanges.push(...this.changes);
  }
}

export class SummonEffect extends Effect {
  private readonly changes: PreparedCastRequest["summonChanges"];

  constructor(changes: PreparedCastRequest["summonChanges"]) {
    super();
    this.changes = changes;
  }

  apply(context: EffectContext): void {
    context.request.summonChanges.push(...this.changes);
  }
}

export class HistoryEffect extends Effect {
  private readonly change: PreparedCastRequest["historyEntries"][number];

  constructor(change: PreparedCastRequest["historyEntries"][number]) {
    super();
    this.change = change;
  }

  apply(context: EffectContext): void {
    context.request.historyEntries.push(this.change);
  }
}

export class LogEffect extends Effect {
  private readonly change: PreparedCastRequest["activityLogEntries"][number];

  constructor(change: PreparedCastRequest["activityLogEntries"][number]) {
    super();
    this.change = change;
  }

  apply(context: EffectContext): void {
    context.request.activityLogEntries.push(this.change);
  }
}

export class UsageCounterEffect extends Effect {
  private readonly change: PreparedCastRequest["usageCounterChanges"][number];

  constructor(change: PreparedCastRequest["usageCounterChanges"][number]) {
    super();
    this.change = change;
  }

  apply(context: EffectContext): void {
    context.request.usageCounterChanges.push(this.change);
  }
}

export class OngoingStateEffect extends Effect {
  private readonly changes: PreparedCastRequest["ongoingStateChanges"];

  constructor(changes: PreparedCastRequest["ongoingStateChanges"]) {
    super();
    this.changes = changes;
  }

  apply(context: EffectContext): void {
    context.request.ongoingStateChanges.push(...this.changes);
  }
}
