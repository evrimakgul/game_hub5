import type { RequestedAction } from "./actions.ts";
import type { CustomEffect, EffectDefinition, ModifierEffect } from "../types/effects.ts";
import type { PowerId } from "../types/game.ts";
import type { KnownPower } from "../types/powers.ts";

export type PassivePowerPackage = {
  effects: EffectDefinition[];
  tags: string[];
  notes: string[];
};

export type CastablePowerOption = {
  powerId: PowerId;
  powerName: string;
  level: number;
  label: string;
  description: string;
  actionType: RequestedAction | null;
  manaCost: number;
  statusEffectId: string;
  statusLabel: string;
};

function createModifierEffect(
  id: string,
  attribute: ModifierEffect["target"]["attribute"],
  value: number,
  label: string
): ModifierEffect {
  return {
    id,
    kind: "modifier",
    label,
    timing: "passive",
    target: {
      scope: "self",
      attribute,
    },
    duration: {
      kind: "passive",
    },
    modifierType: "flat",
    value,
    stacking: "stack",
  };
}

function createCustomEffect(id: string, key: string, label: string): CustomEffect {
  return {
    id,
    kind: "custom",
    key,
    label,
    timing: "passive",
    target: {
      scope: "self",
    },
    duration: {
      kind: "passive",
    },
    data: {
      enabled: true,
    },
  };
}

function getKnownPowerLevel(knownPowers: KnownPower[], powerId: PowerId): number {
  return knownPowers.find((power) => power.powerId === powerId)?.level ?? 0;
}

function getAwarenessPassivePackage(level: number): PassivePowerPackage {
  if (level <= 0) {
    return { effects: [], tags: [], notes: [] };
  }

  return {
    effects: [
      createModifierEffect(
        `power.awareness.alertness.${level}`,
        "alertness",
        level,
        "Awareness Alertness Bonus"
      ),
    ],
    tags: level >= 3 ? ["awareness_anti_invisibility"] : [],
    notes: [
      "Awareness adds its level to alertness checks.",
      level >= 3 ? "Techno-infused invisibility no longer works against this character." : "",
    ].filter(Boolean),
  };
}

function getLightSupportPassivePackage(level: number): PassivePowerPackage {
  if (level <= 0) {
    return { effects: [], tags: [], notes: [] };
  }

  const manaBonus = level >= 5 ? 3 : level >= 3 ? 2 : 1;

  return {
    effects: [
      createModifierEffect(
        `power.light_support.cantrip.mana_bonus.${level}`,
        "mana_bonus",
        manaBonus,
        "Light Support Mana Bonus"
      ),
      createCustomEffect("power.light_support.cantrip.nightvision", "nightvision", "Nightvision"),
    ],
    tags: ["nightvision"],
    notes: [`Light Support cantrip grants nightvision and +${manaBonus} mana bonus.`],
  };
}

export function getPassivePowerPackage(knownPowers: KnownPower[]): PassivePowerPackage {
  const packages = [
    getAwarenessPassivePackage(getKnownPowerLevel(knownPowers, "awareness")),
    getLightSupportPassivePackage(getKnownPowerLevel(knownPowers, "light_support")),
  ];

  return {
    effects: packages.flatMap((entry) => entry.effects),
    tags: [...new Set(packages.flatMap((entry) => entry.tags))],
    notes: packages.flatMap((entry) => entry.notes),
  };
}

export function getCastablePowerOptions(knownPowers: KnownPower[]): CastablePowerOption[] {
  const lightSupportLevel = getKnownPowerLevel(knownPowers, "light_support");

  if (lightSupportLevel <= 0) {
    return [];
  }

  const lightSupportManaCost =
    lightSupportLevel >= 5 ? 4 : lightSupportLevel >= 3 ? 3 : 2;

  return [
    {
      powerId: "light_support",
      powerName: "Light Support",
      level: lightSupportLevel,
      label: "Cast Light Support",
      description:
        "Creates a supported light aura that boosts hit rolls and, at higher levels, grants extra protection.",
      actionType: "standard",
      manaCost: lightSupportManaCost,
      statusEffectId: "light_support",
      statusLabel: "Light Support",
    },
  ];
}
