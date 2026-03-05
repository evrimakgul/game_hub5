import type {
  ActionType,
  CoreStatId,
  CharacterId,
  CombatLogEntryId,
  EncounterId,
  ISODateString,
  ParticipantId,
  PowerId,
  SkillId,
} from "./game";

export type ParticipantKind = "character" | "npc" | "summon";
export type CombatParticipantState = "active" | "defeated" | "removed";

export type ActionPool = Record<ActionType, number | null>;

export interface ActionState {
  available: ActionPool;
  spent: Record<ActionType, number>;
}

export interface CombatParticipant {
  participantId: ParticipantId;
  encounterId: EncounterId;
  characterId: CharacterId | null;
  displayName: string;
  kind: ParticipantKind;
  state: CombatParticipantState;
  initiative: number;
}

export interface TurnState {
  encounterId: EncounterId;
  roundNumber: number;
  initiativeOrder: ParticipantId[];
  activeParticipantId: ParticipantId | null;
  activeIndex: number | null;
  actionState: ActionState;
  turnStartedAt: ISODateString | null;
  updatedAt: ISODateString | null;
}

export interface CombatEncounter {
  encounterId: EncounterId;
  label: string;
  participantIds: ParticipantId[];
  turnState: TurnState;
  createdAt: ISODateString | null;
}

export interface CombatLogEntry {
  combatLogEntryId: CombatLogEntryId;
  encounterId: EncounterId;
  participantId: ParticipantId | null;
  message: string;
  payload: Record<string, unknown>;
  createdAt: ISODateString;
}

export type OwnershipRole = "player" | "dm" | "system";
export type AuthorizationMode = "sandbox" | "role_enforced";

export interface CombatantProfile {
  participantId: ParticipantId;
  displayName: string;
  kind: ParticipantKind;
  ownerRole: OwnershipRole;
  characterId: CharacterId | null;
  coreStats: Record<CoreStatId, number>;
  skillLevels: Partial<Record<SkillId, number>>;
  knownPowers: Partial<Record<PowerId, number>>;
  currentHp: number;
  currentMana: number;
}

export type CombatModifierTarget =
  | CoreStatId
  | "initiative"
  | "armor_class"
  | "damage_reduction"
  | "soak"
  | "melee_attack"
  | "ranged_attack"
  | "melee_damage"
  | "ranged_damage"
  | "successes_to_any_roll";

export interface CombatModifier {
  target: CombatModifierTarget;
  value: number;
}

export interface EffectInstance {
  effectInstanceId: string;
  sourcePowerId: PowerId | null;
  sourcePowerLevel: number | null;
  appliedByParticipantId: ParticipantId | null;
  targetParticipantId: ParticipantId;
  label: string;
  modifiers: CombatModifier[];
  remainingRounds: number | null;
  maintenanceManaCost: number | null;
  metadata: Record<string, unknown>;
}

export interface CombatDerivedState {
  maxHp: number;
  maxMana: number;
  initiative: number;
  armorClass: number;
  damageReduction: number;
  soak: number;
  meleeAttack: number;
  rangedAttack: number;
  meleeDamage: number;
  rangedDamage: number;
  successesToAnyRoll: number;
}

export interface CombatantState {
  profile: CombatantProfile;
  actionState: ActionState;
  derived: CombatDerivedState;
  effects: EffectInstance[];
  statuses: string[];
  defeated: boolean;
}

export interface TurnCursor {
  roundNumber: number;
  initiativeOrder: ParticipantId[];
  activeIndex: number;
}

export type CombatEventType =
  | "combat_started"
  | "turn_advanced"
  | "action_consumed"
  | "attack_resolved"
  | "power_cast"
  | "effect_applied"
  | "effect_expired"
  | "effect_maintained"
  | "combat_finalized";

export interface CombatEvent {
  eventId: string;
  type: CombatEventType;
  roundNumber: number;
  actorParticipantId: ParticipantId | null;
  targetParticipantId: ParticipantId | null;
  message: string;
  payload: Record<string, unknown>;
  createdAt: ISODateString;
}

export type CombatStateStatus = "draft" | "active" | "completed";

export interface CombatState {
  encounterId: EncounterId;
  label: string;
  authorizationMode: AuthorizationMode;
  status: CombatStateStatus;
  participants: Record<ParticipantId, CombatantState>;
  turn: TurnCursor;
  events: CombatEvent[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  endedAt: ISODateString | null;
}
