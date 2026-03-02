import type {
  ActionType,
  CharacterId,
  CombatLogEntryId,
  EncounterId,
  ISODateString,
  ParticipantId,
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
