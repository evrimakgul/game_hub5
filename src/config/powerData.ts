import rawPowerData from "../../json_refs/powers.json" with { type: "json" };

type RuntimePowerCantripLevel = {
  power_level: number;
  mechanics?: Record<string, unknown>;
};

type RuntimePowerCantripDefinition = {
  introduced_at_level?: number;
  levels?: RuntimePowerCantripLevel[];
};

type RuntimePowerLevelDefinition = {
  level: number;
  action_type?: string | null;
  mana_cost?: number | null;
  mechanics?: Record<string, unknown>;
  adjudication?: Record<string, unknown>;
  description?: string;
};

type RuntimePowerDefinition = {
  id: string;
  name: string;
  abbreviation?: string;
  governing_stat: string;
  levels?: RuntimePowerLevelDefinition[];
  cantrip?: RuntimePowerCantripDefinition;
};

type RuntimePowerData = {
  powers?: RuntimePowerDefinition[];
};

const runtimePowerData = rawPowerData as RuntimePowerData;
const runtimePowerDefinitions = runtimePowerData.powers ?? [];

export function getRuntimePowerDefinition(powerId: string): RuntimePowerDefinition | undefined {
  return runtimePowerDefinitions.find((power) => power.id === powerId);
}

export function getRuntimePowerAbbreviation(powerId: string): string | undefined {
  return getRuntimePowerDefinition(powerId)?.abbreviation;
}

export function getRuntimePowerLevelDefinition(
  powerId: string,
  level: number
): RuntimePowerLevelDefinition | undefined {
  return getRuntimePowerDefinition(powerId)?.levels?.find((entry) => entry.level === level);
}

export function getRuntimePowerCantripLevels(powerId: string): RuntimePowerCantripLevel[] {
  return getRuntimePowerDefinition(powerId)?.cantrip?.levels ?? [];
}
