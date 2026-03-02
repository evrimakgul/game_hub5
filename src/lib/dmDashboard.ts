import { calculateArmorClass, calculateInitiative } from "../config/stats";
import { getCrAndRankFromXpUsed } from "../config/xpTables";
import { CORE_STAT_IDS, SKILL_IDS, type EquipmentSlot } from "../types";
import { getSupabaseBrowserClient } from "./supabase";

type CharacterRow = {
  character_id: string;
  profile_id: string;
  display_name: string;
  is_player_character: boolean;
  xp_used: number;
  current_hp: number;
  current_mana: number;
  inspiration: number;
};

type CoreStatRow = {
  character_id: string;
  stat_id: (typeof CORE_STAT_IDS)[number];
  level: number;
};

type SkillRow = {
  character_id: string;
  skill_id: (typeof SKILL_IDS)[number];
  level: number;
};

type EncounterRow = {
  encounter_id: string;
  label: string;
  created_at: string;
};

type ParticipantRow = {
  participant_id: string;
  encounter_id: string;
  character_id: string | null;
  display_name: string;
  kind: "character" | "npc" | "summon";
  state: "active" | "defeated" | "removed";
  initiative: number;
};

type TrackerRow = {
  encounter_id: string;
  round_number: number;
  initiative_order: string[];
  active_participant_id: string | null;
  active_index: number | null;
  available_standard: number;
  available_bonus: number;
  available_move: number;
  available_reaction: number;
  available_free: number | null;
  spent_standard: number;
  spent_bonus: number;
  spent_move: number;
  spent_reaction: number;
  spent_free: number;
  turn_started_at: string | null;
  updated_at: string;
  revision: number;
};

type CombatLogRow = {
  combat_log_entry_id: string;
  encounter_id: string;
  participant_id: string | null;
  message: string;
  created_at: string;
};

export type DmCharacterSummary = {
  characterId: string;
  displayName: string;
  isPlayerCharacter: boolean;
  currentHp: number;
  currentMana: number;
  inspiration: number;
  xpUsed: number;
  rank: string;
  cr: number;
  initiative: number;
  armorClass: number;
};

export type DmEncounterParticipant = {
  participantId: string;
  displayName: string;
  kind: ParticipantRow["kind"];
  state: ParticipantRow["state"];
  initiative: number;
  isActiveTurn: boolean;
};

export type DmEncounterView = {
  encounterId: string;
  label: string;
  roundNumber: number | null;
  revision: number | null;
  activeParticipantId: string | null;
  participants: DmEncounterParticipant[];
  actionSummary: string;
  logs: CombatLogRow[];
};

export type DmDashboardData = {
  characters: DmCharacterSummary[];
  encounters: DmEncounterView[];
};

function createEmptyCoreStats() {
  return Object.fromEntries(CORE_STAT_IDS.map((statId) => [statId, 0])) as Record<
    (typeof CORE_STAT_IDS)[number],
    number
  >;
}

function createEmptySkillLevels() {
  return Object.fromEntries(SKILL_IDS.map((skillId) => [skillId, 0])) as Record<
    (typeof SKILL_IDS)[number],
    number
  >;
}

function buildActionSummary(tracker: TrackerRow | undefined): string {
  if (!tracker) {
    return "No active turn state.";
  }

  return [
    `Std ${tracker.available_standard}/${tracker.spent_standard}`,
    `Bonus ${tracker.available_bonus}/${tracker.spent_bonus}`,
    `Move ${tracker.available_move}/${tracker.spent_move}`,
    `React ${tracker.available_reaction}/${tracker.spent_reaction}`,
  ].join("  ");
}

function sortParticipants(
  encounterId: string,
  participants: ParticipantRow[],
  tracker: TrackerRow | undefined
): DmEncounterParticipant[] {
  const encounterParticipants = participants.filter((row) => row.encounter_id === encounterId);
  const participantMap = new Map(encounterParticipants.map((row) => [row.participant_id, row]));

  if (tracker?.initiative_order?.length) {
    const ordered = tracker.initiative_order
      .map((participantId) => participantMap.get(participantId))
      .filter((row): row is ParticipantRow => Boolean(row));

    const leftovers = encounterParticipants
      .filter((row) => !tracker.initiative_order.includes(row.participant_id))
      .sort((left, right) => right.initiative - left.initiative);

    return [...ordered, ...leftovers].map((row) => ({
      participantId: row.participant_id,
      displayName: row.display_name,
      kind: row.kind,
      state: row.state,
      initiative: row.initiative,
      isActiveTurn: row.participant_id === tracker.active_participant_id,
    }));
  }

  return encounterParticipants
    .slice()
    .sort((left, right) => right.initiative - left.initiative)
    .map((row) => ({
      participantId: row.participant_id,
      displayName: row.display_name,
      kind: row.kind,
      state: row.state,
      initiative: row.initiative,
      isActiveTurn: row.participant_id === tracker?.active_participant_id,
    }));
}

export async function loadDmDashboard(): Promise<DmDashboardData> {
  const client = getSupabaseBrowserClient();

  const [charactersResponse, coreStatsResponse, skillLevelsResponse, encountersResponse, participantsResponse, trackerResponse, logsResponse] =
    await Promise.all([
      client
        .from("characters")
        .select(
          "character_id, profile_id, display_name, is_player_character, xp_used, current_hp, current_mana, inspiration"
        )
        .order("display_name", { ascending: true })
        .returns<CharacterRow[]>(),
      client
        .from("character_core_stats")
        .select("character_id, stat_id, level")
        .returns<CoreStatRow[]>(),
      client
        .from("character_skill_levels")
        .select("character_id, skill_id, level")
        .returns<SkillRow[]>(),
      client
        .from("combat_encounters")
        .select("encounter_id, label, created_at")
        .order("created_at", { ascending: false })
        .returns<EncounterRow[]>(),
      client
        .from("combat_participants")
        .select("participant_id, encounter_id, character_id, display_name, kind, state, initiative")
        .returns<ParticipantRow[]>(),
      client
        .from("combat_tracker")
        .select(
          "encounter_id, round_number, initiative_order, active_participant_id, active_index, available_standard, available_bonus, available_move, available_reaction, available_free, spent_standard, spent_bonus, spent_move, spent_reaction, spent_free, turn_started_at, updated_at, revision"
        )
        .returns<TrackerRow[]>(),
      client
        .from("combat_logs")
        .select("combat_log_entry_id, encounter_id, participant_id, message, created_at")
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<CombatLogRow[]>(),
    ]);

  const errors = [
    charactersResponse.error,
    coreStatsResponse.error,
    skillLevelsResponse.error,
    encountersResponse.error,
    participantsResponse.error,
    trackerResponse.error,
    logsResponse.error,
  ].filter((error): error is NonNullable<typeof charactersResponse.error> => Boolean(error));

  if (errors.length > 0) {
    throw errors[0];
  }

  const coreStatsByCharacter = new Map<string, ReturnType<typeof createEmptyCoreStats>>();
  const skillLevelsByCharacter = new Map<string, ReturnType<typeof createEmptySkillLevels>>();

  for (const row of coreStatsResponse.data ?? []) {
    const target = coreStatsByCharacter.get(row.character_id) ?? createEmptyCoreStats();
    target[row.stat_id] = row.level;
    coreStatsByCharacter.set(row.character_id, target);
  }

  for (const row of skillLevelsResponse.data ?? []) {
    const target = skillLevelsByCharacter.get(row.character_id) ?? createEmptySkillLevels();
    target[row.skill_id] = row.level;
    skillLevelsByCharacter.set(row.character_id, target);
  }

  const characters = (charactersResponse.data ?? []).map((row) => {
    const coreStats = coreStatsByCharacter.get(row.character_id) ?? createEmptyCoreStats();
    const skillLevels = skillLevelsByCharacter.get(row.character_id) ?? createEmptySkillLevels();
    const progression = getCrAndRankFromXpUsed(row.xp_used);

    return {
      characterId: row.character_id,
      displayName: row.display_name,
      isPlayerCharacter: row.is_player_character,
      currentHp: row.current_hp,
      currentMana: row.current_mana,
      inspiration: row.inspiration,
      xpUsed: row.xp_used,
      rank: progression.rank,
      cr: progression.cr,
      initiative: calculateInitiative(coreStats.DEX, coreStats.WITS),
      armorClass: calculateArmorClass(coreStats.DEX, skillLevels.athletics),
    };
  });

  const trackerByEncounter = new Map((trackerResponse.data ?? []).map((row) => [row.encounter_id, row]));
  const logsByEncounter = new Map<string, CombatLogRow[]>();

  for (const row of logsResponse.data ?? []) {
    const target = logsByEncounter.get(row.encounter_id) ?? [];
    target.push(row);
    logsByEncounter.set(row.encounter_id, target);
  }

  const encounters = (encountersResponse.data ?? []).map((row) => {
    const tracker = trackerByEncounter.get(row.encounter_id);

    return {
      encounterId: row.encounter_id,
      label: row.label,
      roundNumber: tracker?.round_number ?? null,
      revision: tracker?.revision ?? null,
      activeParticipantId: tracker?.active_participant_id ?? null,
      participants: sortParticipants(row.encounter_id, participantsResponse.data ?? [], tracker),
      actionSummary: buildActionSummary(tracker),
      logs: logsByEncounter.get(row.encounter_id) ?? [],
    };
  });

  return {
    characters,
    encounters,
  };
}
