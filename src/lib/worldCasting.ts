import type { ActionContext } from "../engine/context.ts";
import { isUndeadSheet } from "../rules/combatResolution.ts";
import {
  applyKnowledgeBatch,
  createItemKnowledgeRevision,
  createItemKnowledgeShareResult,
  doesItemKnowledgeRevisionMatchItem,
  findKnowledgeEntityBySubjectKey,
  getLatestKnowledgeRevisionForEntity,
} from "../lib/knowledge.ts";
import { canCharacterIdentifyItem } from "./items.ts";
import {
  getCastPowerTargetModeForVariant,
  type CastPowerVariantId,
} from "../rules/powerEffects.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { PreparedCastRequest } from "../types/combatEncounterView.ts";
import type {
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemSubcategoryDefinition,
  SharedItemRecord,
} from "../types/items.ts";
import type { KnowledgeState } from "../types/knowledge.ts";
import {
  type CastTargetOption,
  executePreparedCastForContext,
  getPreferredCastPowerVariantForEnvironment,
  isCastPowerVariantSupportedInEnvironment,
  type WorldCastRequestPayload,
} from "./powerCasting.ts";

function isCharacterValidWorldTarget(
  casterCharacter: CharacterRecord,
  targetCharacter: CharacterRecord,
  selectedPower: WorldCastRequestPayload["selectedPower"],
  selectedVariantId: CastPowerVariantId
): boolean {
  if (selectedPower.id === "body_reinforcement" && selectedPower.level === 1) {
    return targetCharacter.id === casterCharacter.id;
  }

  if (selectedPower.id === "healing" && selectedVariantId === "healing_touch") {
    return !isUndeadSheet(targetCharacter.sheet);
  }

  return true;
}

export function getWorldCastTargetOptions(args: {
  casterCharacter: CharacterRecord;
  characters: CharacterRecord[];
  selectedPower: WorldCastRequestPayload["selectedPower"];
  selectedVariantId: CastPowerVariantId;
}): CastTargetOption[] {
  const targetMode = getCastPowerTargetModeForVariant(args.selectedPower, args.selectedVariantId);

  if (targetMode === "self") {
    return [
      {
        id: args.casterCharacter.id,
        label: args.casterCharacter.sheet.name.trim() || args.casterCharacter.id,
      },
    ];
  }

  return args.characters
    .filter((character) =>
      isCharacterValidWorldTarget(
        args.casterCharacter,
        character,
        args.selectedPower,
        args.selectedVariantId
      )
    )
    .map((character) => ({
      id: character.id,
      label: character.sheet.name.trim() || character.id,
    }));
}

function buildWorldActionContext(
  payload: WorldCastRequestPayload
): { error: string } | ActionContext {
  if (
    !isCastPowerVariantSupportedInEnvironment(
      payload.selectedPower,
      payload.selectedVariantId,
      "world"
    )
  ) {
    return { error: "Combat only for now." };
  }

  const validTargetOptions = getWorldCastTargetOptions({
    casterCharacter: payload.casterCharacter,
    characters: payload.characters,
    selectedPower: payload.selectedPower,
    selectedVariantId: payload.selectedVariantId,
  });
  const validTargetIds = new Set(validTargetOptions.map((option) => option.id));
  const selectedTargetIds = payload.selectedTargetIds.filter((targetId) =>
    validTargetIds.has(targetId)
  );
  const fallbackTargetIds = payload.fallbackTargetIds.filter((targetId) =>
    validTargetIds.has(targetId)
  );
  const finalTargetIds = selectedTargetIds.length > 0 ? selectedTargetIds : fallbackTargetIds;
  const finalTargets = finalTargetIds
    .map((targetId) => payload.characters.find((character) => character.id === targetId) ?? null)
    .filter((character): character is CharacterRecord => character !== null);

  if (
    payload.selectedTargetIds.some(
      (targetId) => targetId.length > 0 && !validTargetIds.has(targetId)
    )
  ) {
    return { error: "At least one selected target is not valid for this action." };
  }

  if (finalTargets.length === 0) {
    return { error: "Select at least one valid target before casting." };
  }

  return {
    environment: "world",
    payload: null,
    casterCharacter: payload.casterCharacter,
    casterName: payload.casterCharacter.sheet.name.trim() || payload.casterDisplayName,
    selectedPower: payload.selectedPower,
    selectedSpellId: payload.selectedVariantId,
    encounterParticipants: [],
    itemsById: payload.itemsById ?? {},
    casterView: null,
    validTargetViews: [],
    selectedTargetViews: [],
    fallbackTargetViews: [],
    finalTargetViews: [],
    finalTargets,
    attackOutcome: payload.attackOutcome,
    healingAllocations: Object.fromEntries(
      Object.entries(payload.healingAllocations).map(([targetId, value]) => [
        targetId,
        Math.max(0, Math.trunc(Number(value) || 0)),
      ])
    ),
    selectedStatId: payload.selectedStatId,
    castMode: payload.castMode,
    selectedDamageType: payload.selectedDamageType,
    bonusManaSpend: Math.max(0, Math.trunc(payload.bonusManaSpend)),
    selectedSummonOptionId: payload.selectedSummonOptionId,
  };
}

export function prepareWorldCastRequest(
  payload: WorldCastRequestPayload
): { error: string } | { request: PreparedCastRequest; warnings: string[] } {
  const contextResult = buildWorldActionContext(payload);
  if ("error" in contextResult) {
    return contextResult;
  }

  return executePreparedCastForContext(
    contextResult,
    `${payload.selectedPower.name} does not have a supported world-cast implementation.`
  );
}

export function getInitialWorldVariantId(
  power: WorldCastRequestPayload["selectedPower"]
): CastPowerVariantId {
  return getPreferredCastPowerVariantForEnvironment(power, "world");
}

export function executeArtifactAppraisalWorldCast(args: {
  casterCharacter: CharacterRecord;
  item: SharedItemRecord;
  artifactAppraisalLevel: number;
  knowledgeState: KnowledgeState;
  context: {
    itemBlueprints: ItemBlueprintRecord[];
    itemCategoryDefinitions: ItemCategoryDefinition[];
    itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  };
}):
  | { error: string }
  | {
      knowledgeState: KnowledgeState;
      item: SharedItemRecord;
      historyEntries: Array<{ characterId: string; entry: CharacterRecord["sheet"]["gameHistory"][number] }>;
    } {
  if (!canCharacterIdentifyItem(args.item, args.artifactAppraisalLevel)) {
    return { error: "Artifact Appraisal is unavailable." };
  }

  let nextKnowledgeState = args.knowledgeState;
  let entity = findKnowledgeEntityBySubjectKey(nextKnowledgeState, "item", args.item.id);
  let revision =
    entity !== null ? getLatestKnowledgeRevisionForEntity(nextKnowledgeState, entity.id) : null;

  if (
    entity === null ||
    revision === null ||
    !doesItemKnowledgeRevisionMatchItem(args.item, revision, args.context)
  ) {
    const created = createItemKnowledgeRevision({
      state: nextKnowledgeState,
      item: args.item,
      createdByCharacterId: args.casterCharacter.id,
      sourceType: "spell",
      sourceSpellName: `Artifact Appraisal Lv ${args.artifactAppraisalLevel}`,
      context: args.context,
    });
    nextKnowledgeState = applyKnowledgeBatch(nextKnowledgeState, created.batch);
    entity = created.entity;
    revision = created.revision;
  }

  if (!entity || !revision) {
    return { error: "Failed to create the item card." };
  }

  const revealResult = createItemKnowledgeShareResult({
    state: nextKnowledgeState,
    item: args.item,
    entity,
    revision,
    sourceOwnerCharacterId: null,
    sourceOwnerName: "Artifact Appraisal",
    recipientCharacters: [args.casterCharacter],
  });

  return {
    knowledgeState: applyKnowledgeBatch(nextKnowledgeState, revealResult.batch),
    item: revealResult.item,
    historyEntries: revealResult.historyEntries,
  };
}
